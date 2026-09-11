param(
    [Parameter(Position = 0)]
    [string]$OperationPath,
    # Serve mode keeps one process alive so the Add-Type P/Invoke assembly below
    # is emitted once per session instead of once per operation.
    [switch]$Serve
)

$ErrorActionPreference = "Stop"
# Progress records render to the host, which in serve mode is a pipe carrying
# one JSON response per line; a stray record would desynchronise the stream.
$ProgressPreference = "SilentlyContinue"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class NightshiftDesktopWin32 {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public INPUTUNION data;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION {
        [FieldOffset(0)]
        public MOUSEINPUT mouse;
        [FieldOffset(0)]
        public KEYBDINPUT keyboard;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort virtualKey;
        public ushort scanCode;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool ScreenToClient(IntPtr hwnd, ref POINT point);

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern uint SendInput(uint count, INPUT[] inputs, int size);

    public static void SendModifiedClick(byte[] modifiers, uint mouseDown, uint mouseUp) {
        const uint keyboardInput = 1;
        const uint mouseInput = 0;
        const uint keyUp = 0x0002;
        var inputs = new List<INPUT>();
        foreach (var modifier in modifiers) {
            inputs.Add(KeyboardInput(keyboardInput, modifier, 0));
        }
        inputs.Add(MouseInput(mouseInput, mouseDown));
        inputs.Add(MouseInput(mouseInput, mouseUp));
        for (var index = modifiers.Length - 1; index >= 0; index--) {
            inputs.Add(KeyboardInput(keyboardInput, modifiers[index], keyUp));
        }
        var values = inputs.ToArray();
        var sent = SendInput((uint)values.Length, values, Marshal.SizeOf(typeof(INPUT)));
        if (sent != (uint)values.Length) {
            var releases = new List<INPUT>();
            releases.Add(MouseInput(mouseInput, mouseUp));
            for (var index = modifiers.Length - 1; index >= 0; index--) {
                releases.Add(KeyboardInput(keyboardInput, modifiers[index], keyUp));
            }
            var releaseValues = releases.ToArray();
            SendInput((uint)releaseValues.Length, releaseValues, Marshal.SizeOf(typeof(INPUT)));
            throw new InvalidOperationException("SendInput did not complete the modified click");
        }
    }

    private static INPUT KeyboardInput(uint type, byte virtualKey, uint flags) {
        return new INPUT {
            type = type,
            data = new INPUTUNION {
                keyboard = new KEYBDINPUT { virtualKey = virtualKey, flags = flags }
            }
        };
    }

    private static INPUT MouseInput(uint type, uint flags) {
        return new INPUT {
            type = type,
            data = new INPUTUNION {
                mouse = new MOUSEINPUT { flags = flags }
            }
        };
    }
}
"@

$MaxNodes = 1200
$MaxDepth = 64
$TextLimit = 500
$MaxScreenshotPngBytes = 900000
$MaxScreenshotEdge = 1280
$MinScreenshotScale = 0.25
$ScreenshotScaleStep = 0.85
$BlockedAppFragments = @(
    "1password",
    "bitwarden",
    "dashlane",
    "lastpass",
    "nordpass",
    "proton pass"
)

$WindowsMessages = @{
    Char = 0x0102
    KeyDown = 0x0100
    KeyUp = 0x0101
    MouseMove = 0x0200
    LeftDown = 0x0201
    LeftUp = 0x0202
    RightDown = 0x0204
    RightUp = 0x0205
    MiddleDown = 0x0207
    MiddleUp = 0x0208
    Wheel = 0x020A
}

$MouseEvents = @{
    LeftDown = 0x0002
    LeftUp = 0x0004
    RightDown = 0x0008
    RightUp = 0x0010
    MiddleDown = 0x0020
    MiddleUp = 0x0040
    Wheel = 0x0800
    HorizontalWheel = 0x01000
}

function Write-NightshiftJson($Payload) {
    $Payload | ConvertTo-Json -Depth 100 -Compress
}

function New-NightshiftFrame([double]$X, [double]$Y, [double]$Width, [double]$Height) {
    if ($Width -le 0 -or $Height -le 0) { return $null }
    [pscustomobject]@{ x = $X; y = $Y; width = $Width; height = $Height }
}

function Read-NightshiftOperation([string]$Path) {
    Get-Content -Raw -Encoding UTF8 -Path $Path | ConvertFrom-Json
}

function ConvertTo-NightshiftLParam([int]$X, [int]$Y) {
    [IntPtr]((($Y -band 0xffff) -shl 16) -bor ($X -band 0xffff))
}

function ConvertTo-NightshiftWheelParam([int]$Delta) {
    [IntPtr](($Delta -band 0xffff) -shl 16)
}

function Get-NightshiftWindowProcesses {
    @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object ProcessName, Id)
}

function Find-NightshiftProcess([string]$Query) {
    $needle = ""
    if ($null -ne $Query) { $needle = $Query.Trim() }
    if ([string]::IsNullOrWhiteSpace($needle)) { throw 'appNotFound("")' }
    if ($needle.StartsWith("pid:", [System.StringComparison]::OrdinalIgnoreCase)) {
        $needle = $needle.Substring(4)
    }

    $parsedProcessId = 0
    $processes = Get-NightshiftWindowProcesses
    if ([int]::TryParse($needle, [ref]$parsedProcessId)) {
        $match = $processes | Where-Object { $_.Id -eq $parsedProcessId } | Select-Object -First 1
        if ($null -ne $match) {
            Assert-NightshiftProcessAllowed $match
            return $match
        }
    }

    $processNeedle = $needle
    if ($processNeedle.EndsWith(".exe", [System.StringComparison]::OrdinalIgnoreCase)) {
        $processNeedle = $processNeedle.Substring(0, $processNeedle.Length - 4)
    }

    $match = $processes | Where-Object {
        $_.ProcessName -ieq $processNeedle -or
        "$($_.ProcessName).exe" -ieq $needle -or
        $_.MainWindowTitle -ieq $needle -or
        $_.MainWindowTitle -ilike "*$needle*"
    } | Select-Object -First 1
    if ($null -ne $match) {
        Assert-NightshiftProcessAllowed $match
        return $match
    }

    throw "appNotFound(`"$Query`")"
}

function Assert-NightshiftProcessAllowed($Process) {
    $values = @($Process.ProcessName, $Process.MainWindowTitle) | ForEach-Object { ([string]$_).ToLowerInvariant() }
    foreach ($fragment in $BlockedAppFragments) {
        foreach ($value in $values) {
            if ($value.Contains($fragment)) {
                throw "appBlocked(`"$($Process.ProcessName)`")"
            }
        }
    }
}

function Test-NightshiftBrowserProcess($Process) {
    $name = ([string]$Process.ProcessName).ToLowerInvariant()
    $browserProcesses = @(
        "arc",
        "brave",
        "chrome",
        "chromium",
        "firefox",
        "librewolf",
        "msedge",
        "opera",
        "vivaldi",
        "zen"
    )
    $browserProcesses -contains $name
}

function Get-NightshiftRootElement($Process) {
    if ($Process.MainWindowHandle -eq 0) {
        throw "No top-level UI Automation window is available for $($Process.ProcessName)."
    }
    [Windows.Automation.AutomationElement]::FromHandle([IntPtr]$Process.MainWindowHandle)
}

function Get-NightshiftWindowFrame($Process, $RootElement) {
    $rect = New-Object NightshiftDesktopWin32+RECT
    if ([NightshiftDesktopWin32]::GetWindowRect([IntPtr]$Process.MainWindowHandle, [ref]$rect)) {
        return New-NightshiftFrame $rect.Left $rect.Top ($rect.Right - $rect.Left) ($rect.Bottom - $rect.Top)
    }

    try {
        $bounds = $RootElement.Current.BoundingRectangle
        if (-not $bounds.IsEmpty) {
            return New-NightshiftFrame $bounds.X $bounds.Y $bounds.Width $bounds.Height
        }
    } catch {}
    $null
}

function Get-NightshiftWindowId($Process) {
    [int64]$Process.MainWindowHandle
}

function Get-NightshiftAppName($Process) {
    if ($Process.ProcessName -eq "ApplicationFrameHost" -and -not [string]::IsNullOrWhiteSpace($Process.MainWindowTitle)) {
        return [string]$Process.MainWindowTitle
    }
    [string]$Process.ProcessName
}

function New-NightshiftAppRecord($Process) {
    [pscustomobject]@{
        name = Get-NightshiftAppName $Process
        bundleIdentifier = $Process.ProcessName
        bundleId = $Process.ProcessName
        pid = [int]$Process.Id
    }
}

function Assert-NightshiftWindowTarget($Process, $WindowId, $WindowIndex) {
    if ($null -ne $WindowIndex -and [int]$WindowIndex -ne 0) {
        throw "windowNotFound(`"$WindowIndex`")"
    }
    if ($null -ne $WindowId -and [int64]$WindowId -ne (Get-NightshiftWindowId $Process)) {
        throw "windowNotFound(`"$WindowId`")"
    }
}

function Restore-NightshiftWindow($Process) {
    if ($Process.MainWindowHandle -eq 0) { return }
    [void][NightshiftDesktopWin32]::ShowWindow([IntPtr]$Process.MainWindowHandle, 9)
    [void][NightshiftDesktopWin32]::SetForegroundWindow([IntPtr]$Process.MainWindowHandle)
}

function Test-NightshiftWindowFocused([IntPtr]$WindowHandle) {
    [NightshiftDesktopWin32]::GetForegroundWindow() -eq $WindowHandle
}

function Wait-NightshiftWindowFocused([IntPtr]$WindowHandle, [int]$TimeoutMilliseconds) {
    $stopwatch = [Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.ElapsedMilliseconds -lt $TimeoutMilliseconds) {
        if (Test-NightshiftWindowFocused $WindowHandle) { return $true }
        Start-Sleep -Milliseconds 50
    }
    Test-NightshiftWindowFocused $WindowHandle
}

function Assert-NightshiftKeyboardFocus([IntPtr]$WindowHandle, $Operation) {
    if (Test-NightshiftWindowFocused $WindowHandle) { return }
    if ([bool]$Operation.restoreWindow) {
        if (Wait-NightshiftWindowFocused $WindowHandle 500) { return }
        throw "window_not_focused: keyboard input requires the target window to be focused; restoreWindow was requested but the target window is still not focused; bring it forward manually or check desktop permissions"
    }
    throw "window_not_focused: keyboard input requires the target window to be focused; retry with --restore-window"
}

function Get-NightshiftElementFrame($Element, $WindowFrame) {
    try {
        $bounds = $Element.Current.BoundingRectangle
        if ($bounds.IsEmpty) { return $null }
        if ($null -eq $WindowFrame) {
            return New-NightshiftFrame $bounds.X $bounds.Y $bounds.Width $bounds.Height
        }
        New-NightshiftFrame ($bounds.X - $WindowFrame.x) ($bounds.Y - $WindowFrame.y) $bounds.Width $bounds.Height
    } catch {
        $null
    }
}

function Get-NightshiftProperty($Element, [string]$Name) {
    try { [string]$Element.Current.$Name } catch { "" }
}

function Get-NightshiftRuntimeId($Element) {
    try { @($Element.GetRuntimeId()) } catch { @() }
}

function Test-NightshiftSensitiveElement($Element) {
    try {
        if ($Element.Current.IsPassword) { return $true }
    } catch {}
    $controlType = try { [string]$Element.Current.ControlType.ProgrammaticName } catch { "" }
    $parts = @(
        (Get-NightshiftProperty $Element "LocalizedControlType"),
        $controlType,
        (Get-NightshiftProperty $Element "Name"),
        (Get-NightshiftProperty $Element "AutomationId"),
        (Get-NightshiftProperty $Element "ClassName")
    )
    $haystack = (($parts -join " ") -replace "\s+", " ").ToLowerInvariant()
    foreach ($term in @("password", "passcode", "secret", "one-time code", "verification code")) {
        if ($haystack.Contains($term)) { return $true }
    }
    $haystack -match "(^|[^a-z0-9])pin([^a-z0-9]|$)"
}

function Get-NightshiftValueText($Element) {
    try {
        if (Test-NightshiftSensitiveElement $Element) { return "[redacted]" }
        $pattern = $Element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
        $rawValue = $pattern.Current.Value
        $text = if ($null -eq $rawValue) { "" } else { [string]$rawValue }
        if ($text.Length -gt $TextLimit) { return $text.Substring(0, $TextLimit) + "..." }
        $text
    } catch {
        ""
    }
}

function Get-NightshiftActions($Element) {
    $actions = New-Object System.Collections.Generic.List[string]
    foreach ($pattern in $Element.GetSupportedPatterns()) {
        $name = [string]$pattern.ProgrammaticName
        if ($name -like "InvokePatternIdentifiers.Pattern") { $actions.Add("Invoke") }
        elseif ($name -like "TogglePatternIdentifiers.Pattern") { $actions.Add("Toggle") }
        elseif ($name -like "SelectionItemPatternIdentifiers.Pattern") { $actions.Add("Select") }
        elseif ($name -like "ScrollPatternIdentifiers.Pattern") { $actions.Add("Scroll") }
        elseif ($name -like "ValuePatternIdentifiers.Pattern") { $actions.Add("SetValue") }
    }
    @($actions | Select-Object -Unique)
}

function Get-NightshiftMeaningfulActions($Actions) {
    $noisy = @("Invoke", "ScrollToVisible", "ShowMenu")
    @($Actions | Where-Object { $noisy -notcontains $_ })
}

function Format-NightshiftSnapshotText([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    (($Text -replace "\s+", " ").Trim())
}

function Format-NightshiftValueSegment([string]$RoleKey, [string]$Title, [string]$Value) {
    $clean = Format-NightshiftSnapshotText $Value
    if ([string]::IsNullOrWhiteSpace($clean) -or $clean -eq $Title) { return "" }
    if ($RoleKey -eq "heading" -and $clean -match "^\d+$") { return "" }
    if ($RoleKey -in @("text", "edit", "document", "scroll bar", "progress bar")) {
        return " $clean"
    }
    ", Value: $clean"
}

function Test-NightshiftSuppressChildren([string]$RoleKey, [string]$Title, [string]$Value, [string]$Summary) {
    $hasCompactLabel = -not [string]::IsNullOrWhiteSpace($Title) -or -not [string]::IsNullOrWhiteSpace((Format-NightshiftSnapshotText $Value)) -or -not [string]::IsNullOrWhiteSpace((Format-NightshiftSnapshotText $Summary))
    $hasCompactLabel -and $RoleKey -in @(
        "button",
        "check box",
        "combo box",
        "heading",
        "hyperlink",
        "link",
        "menu item",
        "radio button",
        "tab item"
    )
}

function Get-NightshiftTextSnippets($Element, [int]$Limit = 6, [int]$MaxDepth = 3) {
    $values = New-Object System.Collections.Generic.List[string]
    $seen = New-Object System.Collections.Generic.HashSet[string]

    function Visit-NightshiftText($Node, [int]$Depth) {
        if ($values.Count -ge $Limit -or $Depth -gt $MaxDepth) { return }
        $role = try { [string]$Node.Current.LocalizedControlType } catch { "" }
        if ($role -match "text|link|label") {
            foreach ($raw in @((Get-NightshiftProperty $Node "Name"), (Get-NightshiftValueText $Node))) {
                $value = (($raw -replace "\s+", " ").Trim())
                if (-not [string]::IsNullOrWhiteSpace($value) -and $seen.Add($value)) {
                    if ($value.Length -gt 80) { $value = $value.Substring(0, 80) + "..." }
                    $values.Add($value)
                    if ($values.Count -ge $Limit) { return }
                }
            }
        }
        try {
            $children = $Node.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition)
            for ($i = 0; $i -lt $children.Count; $i++) {
                Visit-NightshiftText $children.Item($i) ($Depth + 1)
                if ($values.Count -ge $Limit) { return }
            }
        } catch {}
    }

    Visit-NightshiftText $Element 0
    @($values.ToArray())
}

function Test-NightshiftPlainTextSubtree($Element, [int]$MaxDepth = 4) {
    $script:sawNightshiftText = $false
    $allowed = @("pane", "group", "custom", "unknown", "text", "link", "image")

    function Visit-NightshiftPlainText($Node, [int]$Depth) {
        if ($Depth -gt $MaxDepth) { return $false }
        $role = try { [string]$Node.Current.LocalizedControlType } catch { "" }
        $roleKey = $role.ToLowerInvariant()
        if ($allowed -notcontains $roleKey) { return $false }
        if ($roleKey -match "text|link") { $script:sawNightshiftText = $true }
        if (@(Get-NightshiftMeaningfulActions @(Get-NightshiftActions $Node)).Count -gt 0) { return $false }
        try {
            $children = $Node.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition)
            for ($i = 0; $i -lt $children.Count; $i++) {
                if (-not (Visit-NightshiftPlainText $children.Item($i) ($Depth + 1))) { return $false }
            }
        } catch {}
        return $true
    }

    (Visit-NightshiftPlainText $Element 0) -and $script:sawNightshiftText
}

function New-NightshiftElementRecord($Element, [int]$Index, $WindowFrame) {
    $controlType = try { [string]$Element.Current.ControlType.ProgrammaticName } catch { "" }
    $nativeWindowHandle = try { [int64]$Element.Current.NativeWindowHandle } catch { 0 }
    [pscustomobject]@{
        index = $Index
        runtimeId = @(Get-NightshiftRuntimeId $Element)
        automationId = Get-NightshiftProperty $Element "AutomationId"
        name = Get-NightshiftProperty $Element "Name"
        controlType = $controlType
        localizedControlType = Get-NightshiftProperty $Element "LocalizedControlType"
        className = Get-NightshiftProperty $Element "ClassName"
        value = Get-NightshiftValueText $Element
        isSelected = Test-NightshiftElementSelected $Element
        nativeWindowHandle = $nativeWindowHandle
        frame = Get-NightshiftElementFrame $Element $WindowFrame
        actions = @(Get-NightshiftActions $Element)
    }
}

function Test-NightshiftElementSelected($Element) {
    try {
        $pattern = $Element.GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern)
        return [bool]$pattern.Current.IsSelected
    } catch {
        return $false
    }
}

function Render-NightshiftTree($RootElement, $WindowFrame, [bool]$CompactBrowserTabs = $false) {
    $records = New-Object System.Collections.Generic.List[object]
    $lines = New-Object System.Collections.Generic.List[string]
    $seen = New-Object System.Collections.Generic.HashSet[string]
    $truncation = [pscustomobject]@{
        truncated = $false
        maxNodes = $MaxNodes
        maxDepth = $MaxDepth
        maxDepthReached = $false
    }

    function Visit-NightshiftNode($Node, [int]$Depth) {
        if ($records.Count -ge $MaxNodes -or $Depth -gt $MaxDepth) {
            $truncation.truncated = $true
            if ($Depth -gt $MaxDepth) { $truncation.maxDepthReached = $true }
            return
        }
        $identity = try { (@($Node.GetRuntimeId()) -join ".") } catch { [Guid]::NewGuid().ToString() }
        if (-not $seen.Add($identity)) { return }

        $record = New-NightshiftElementRecord $Node $records.Count $WindowFrame
        $children = @()
        try {
            $children = @($Node.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition))
        } catch {}
        $meaningfulActions = @(Get-NightshiftMeaningfulActions $record.actions)
        $title = if ([string]::IsNullOrWhiteSpace($record.name)) { $record.automationId } else { $record.name }
        $role = if ([string]::IsNullOrWhiteSpace($record.localizedControlType)) { $record.controlType } else { $record.localizedControlType }
        $roleKey = $role.ToLowerInvariant()
        $genericSummary = $null
        if (($roleKey -in @("pane", "group", "custom", "unknown")) -and [string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($record.value)) {
            $snippets = @(Get-NightshiftTextSnippets $Node 8 4)
            if ($snippets.Count -ge 2 -and (Test-NightshiftPlainTextSubtree $Node)) {
                $genericSummary = ($snippets -join " ")
            }
        }
        if (($roleKey -in @("pane", "group", "custom", "unknown")) -and [string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($record.value) -and $meaningfulActions.Count -eq 0 -and $null -eq $genericSummary -and $children.Count -le 1) {
            for ($i = 0; $i -lt $children.Count; $i++) {
                Visit-NightshiftNode $children.Item($i) $Depth
            }
            return
        }

        $records.Add($record)

        $line = "$($record.index) $role $(Format-NightshiftSnapshotText $title)".TrimEnd()
        $line += Format-NightshiftValueSegment $roleKey $title $record.value
        if (-not [string]::IsNullOrWhiteSpace($genericSummary) -and $genericSummary -ne $title) {
            $line += ", Text: " + (Format-NightshiftSnapshotText $genericSummary)
        } elseif ($roleKey -in @("row", "data item", "list item")) {
            $rowSummary = @((Get-NightshiftTextSnippets $Node 6 3)) -join " "
            if (-not [string]::IsNullOrWhiteSpace($rowSummary) -and $rowSummary -ne $title) {
                $line += ", Text: " + (Format-NightshiftSnapshotText $rowSummary)
            }
        }
        if ($meaningfulActions.Count -gt 0) {
            $line += ", Secondary Actions: " + ($meaningfulActions -join ", ")
        }
        $lines.Add(("`t" * $Depth) + $line)

        if (-not [string]::IsNullOrWhiteSpace($genericSummary) -or (Test-NightshiftSuppressChildren $roleKey $title $record.value $genericSummary)) { return }
        $childLineStart = $lines.Count
        for ($i = 0; $i -lt $children.Count; $i++) {
            Visit-NightshiftNode $children.Item($i) ($Depth + 1)
        }
        if ($CompactBrowserTabs) {
            Compress-NightshiftRenderedBrowserTabs $records $lines $childLineStart ($Depth + 1)
        }
    }

    Visit-NightshiftNode $RootElement 0
    [pscustomobject]@{ elements = @($records.ToArray()); lines = @($lines.ToArray()); truncation = $truncation }
}

function Compress-NightshiftRenderedBrowserTabs($Records, $Lines, [int]$StartLine, [int]$Depth) {
    $tabLineIndexes = New-Object System.Collections.Generic.List[int]
    for ($lineIndex = $StartLine; $lineIndex -lt $Lines.Count; $lineIndex++) {
        if (Test-NightshiftDirectRenderedBrowserTabLine ([string]$Lines[$lineIndex]) $Depth) {
            $tabLineIndexes.Add($lineIndex)
        }
    }
    if ($tabLineIndexes.Count -lt 10) { return }

    $recordsByIndex = @{}
    foreach ($record in @($Records.ToArray())) {
        $recordsByIndex[[int]$record.index] = $record
    }
    $activeLineIndexes = New-Object System.Collections.Generic.HashSet[int]
    foreach ($lineIndex in $tabLineIndexes) {
        if (Test-NightshiftActiveRenderedBrowserTabLine ([string]$Lines[$lineIndex]) $Depth $recordsByIndex) {
            [void]$activeLineIndexes.Add($lineIndex)
        }
    }
    if ($activeLineIndexes.Count -eq 0) { return }

    $omittedRecordIndexes = New-Object System.Collections.Generic.HashSet[int]
    $omittedCount = 0
    $insertionIndex = $tabLineIndexes[0]
    for ($i = $tabLineIndexes.Count - 1; $i -ge 0; $i--) {
        $lineIndex = $tabLineIndexes[$i]
        if ($activeLineIndexes.Contains($lineIndex)) { continue }
        $recordIndex = Get-NightshiftRenderedElementIndex ([string]$Lines[$lineIndex]) $Depth
        if ($null -ne $recordIndex) {
            [void]$omittedRecordIndexes.Add([int]$recordIndex)
        }
        $Lines.RemoveAt($lineIndex)
        $omittedCount++
    }
    if ($omittedCount -le 0) { return }
    for ($recordIndex = $Records.Count - 1; $recordIndex -ge 0; $recordIndex--) {
        if ($omittedRecordIndexes.Contains([int]$Records[$recordIndex].index)) {
            $Records.RemoveAt($recordIndex)
        }
    }
    $Lines.Insert($insertionIndex, (("`t" * $Depth) + "... $omittedCount inactive browser tabs omitted"))
}

function Test-NightshiftDirectRenderedBrowserTabLine([string]$Line, [int]$Depth) {
    $indent = "`t" * $Depth
    if (-not $Line.StartsWith($indent)) { return $false }
    $text = $Line.Substring($indent.Length)
    if ($text.StartsWith("`t")) { return $false }
    $text -match "^\d+ (page tab|tab item|tab)($|[ \(,])"
}

function Test-NightshiftActiveRenderedBrowserTabLine([string]$Line, [int]$Depth, $RecordsByIndex) {
    if ($Line.Contains("(selected")) { return $true }
    $recordIndex = Get-NightshiftRenderedElementIndex $Line $Depth
    if ($null -eq $recordIndex -or -not $RecordsByIndex.ContainsKey([int]$recordIndex)) { return $false }
    $record = $RecordsByIndex[[int]$recordIndex]
    [bool]$record.isSelected -or (Format-NightshiftSnapshotText $record.value) -eq "1"
}

function Get-NightshiftRenderedElementIndex([string]$Line, [int]$Depth) {
    $text = $Line.Substring(("`t" * $Depth).Length)
    if ($text -match "^(\d+)") { return [int]$Matches[1] }
    $null
}

function ConvertTo-NightshiftPngBytes([System.Drawing.Image]$Image) {
    $stream = $null
    try {
        $stream = New-Object System.IO.MemoryStream
        $Image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        return ,$stream.ToArray()
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function New-NightshiftScreenshotPayload([byte[]]$Bytes, [int]$Width, [int]$Height, [double]$Scale) {
    [pscustomobject]@{
        base64 = [Convert]::ToBase64String($Bytes)
        width = $Width
        height = $Height
        scale = $Scale
    }
}

function Resize-NightshiftBitmap([System.Drawing.Bitmap]$Source, [int]$Width, [int]$Height) {
    $resized = $null
    $graphics = $null
    try {
        $resized = New-Object System.Drawing.Bitmap $Width, $Height
        $graphics = [System.Drawing.Graphics]::FromImage($resized)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
        $graphics.DrawImage($Source, 0, 0, $Width, $Height)
        $result = $resized
        $resized = $null
        return $result
    } finally {
        if ($null -ne $graphics) { $graphics.Dispose() }
        if ($null -ne $resized) { $resized.Dispose() }
    }
}

function Get-NightshiftBoundedScreenshotPayload([System.Drawing.Bitmap]$Bitmap) {
    $originalWidth = [int][Math]::Max(1, $Bitmap.Width)
    $originalHeight = [int][Math]::Max(1, $Bitmap.Height)
    $pngBytes = ConvertTo-NightshiftPngBytes $Bitmap
    if ($pngBytes.Length -le $MaxScreenshotPngBytes) {
        return New-NightshiftScreenshotPayload $pngBytes $originalWidth $originalHeight 1.0
    }

    # Why: screenshots cross process boundaries as PNG base64 in JSON; cap noisy
    # large-window payloads to match the macOS provider's memory bounds.
    $scale = [Math]::Min(1.0, $MaxScreenshotEdge / [double][Math]::Max($originalWidth, $originalHeight))
    while ($scale -ge $MinScreenshotScale) {
        $width = [int][Math]::Max(1, [Math]::Round($originalWidth * $scale))
        $height = [int][Math]::Max(1, [Math]::Round($originalHeight * $scale))
        if ($width -eq $originalWidth -and $height -eq $originalHeight) {
            $scale *= $ScreenshotScaleStep
            continue
        }

        $resized = $null
        try {
            $resized = Resize-NightshiftBitmap $Bitmap $width $height
            $candidateBytes = ConvertTo-NightshiftPngBytes $resized
            if ($candidateBytes.Length -le $MaxScreenshotPngBytes) {
                return New-NightshiftScreenshotPayload $candidateBytes $width $height ($width / [double]$originalWidth)
            }
        } finally {
            if ($null -ne $resized) { $resized.Dispose() }
        }

        $scale *= $ScreenshotScaleStep
    }

    [pscustomobject]@{
        error = [pscustomobject]@{
            code = "screenshot_failed"
            message = "screenshot exceeded the computer-use payload cap after downscaling; retry with --no-screenshot or target a smaller window"
        }
    }
}

function Get-NightshiftScreenshot([bool]$IncludeScreenshot, $WindowFrame) {
    if (-not $IncludeScreenshot -or $null -eq $WindowFrame) { return $null }
    $bitmap = $null
    $graphics = $null
    try {
        $width = [int][Math]::Max(1, [Math]::Round($WindowFrame.width))
        $height = [int][Math]::Max(1, [Math]::Round($WindowFrame.height))
        $bitmap = New-Object System.Drawing.Bitmap $width, $height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen([int][Math]::Round($WindowFrame.x), [int][Math]::Round($WindowFrame.y), 0, 0, $bitmap.Size)
        Get-NightshiftBoundedScreenshotPayload $bitmap
    } catch {
        $null
    } finally {
        if ($null -ne $graphics) { $graphics.Dispose() }
        if ($null -ne $bitmap) { $bitmap.Dispose() }
    }
}

function New-NightshiftSnapshot([string]$Query, [bool]$IncludeScreenshot, $WindowId = $null, $WindowIndex = $null, [bool]$RestoreWindow = $false) {
    $process = Find-NightshiftProcess $Query
    if ($RestoreWindow) { Restore-NightshiftWindow $process }
    Assert-NightshiftWindowTarget $process $WindowId $WindowIndex
    $root = Get-NightshiftRootElement $process
    $windowFrame = Get-NightshiftWindowFrame $process $root
    $tree = Render-NightshiftTree $root $windowFrame (Test-NightshiftBrowserProcess $process)
    $screenshot = Get-NightshiftScreenshot $IncludeScreenshot $windowFrame

    [pscustomobject]@{
        snapshotId = [guid]::NewGuid().ToString()
        app = New-NightshiftAppRecord $process
        windowTitle = $process.MainWindowTitle
        windowId = Get-NightshiftWindowId $process
        windowBounds = $windowFrame
        screenshotPngBase64 = if ($null -ne $screenshot) { $screenshot.base64 } else { $null }
        screenshotWidth = if ($null -ne $screenshot) { $screenshot.width } else { $null }
        screenshotHeight = if ($null -ne $screenshot) { $screenshot.height } else { $null }
        screenshotScale = if ($null -ne $screenshot) { $screenshot.scale } else { $null }
        screenshotError = if ($null -ne $screenshot) { $screenshot.error } else { $null }
        coordinateSpace = "window"
        truncation = $tree.truncation
        treeLines = @($tree.lines)
        focusedSummary = $null
        focusedElementId = $null
        selectedText = $null
        elements = @($tree.elements)
    }
}

function Get-NightshiftAppList {
    @(Get-NightshiftWindowProcesses | ForEach-Object {
        New-NightshiftAppRecord $_
    })
}

function Get-NightshiftWindowList([string]$Query) {
    $process = Find-NightshiftProcess $Query
    $root = Get-NightshiftRootElement $process
    $windowFrame = Get-NightshiftWindowFrame $process $root
    $x = $null
    $y = $null
    $width = 0
    $height = 0
    if ($null -ne $windowFrame) {
        $x = [int][Math]::Round($windowFrame.x)
        $y = [int][Math]::Round($windowFrame.y)
        $width = [int][Math]::Max(0, [Math]::Round($windowFrame.width))
        $height = [int][Math]::Max(0, [Math]::Round($windowFrame.height))
    }
    $app = New-NightshiftAppRecord $process
    [pscustomobject]@{
        app = $app
        windows = @([pscustomobject]@{
            index = 0
            app = $app
            id = Get-NightshiftWindowId $process
            title = $process.MainWindowTitle
            x = $x
            y = $y
            width = $width
            height = $height
            isMinimized = $false
            isOffscreen = $false
            screenIndex = $null
            platform = [pscustomobject]@{ backend = "uia"; nativeWindowHandle = Get-NightshiftWindowId $process }
        })
    }
}

function Get-NightshiftHandshake {
    [pscustomobject]@{
        platform = "win32"
        provider = "nightshift-computer-use-windows"
        providerVersion = "1.0.0"
        protocolVersion = 1
        supports = [pscustomobject]@{
            apps = [pscustomobject]@{ list = $true; bundleIds = $false; pids = $true }
            windows = [pscustomobject]@{ list = $true; targetById = $true; targetByIndex = $true; focus = $false; moveResize = $false }
            observation = [pscustomobject]@{ screenshot = $true; annotatedScreenshot = $false; elementFrames = $true; ocr = $false }
            actions = [pscustomobject]@{
                click = $true
                typeText = $true
                pressKey = $true
                hotkey = $true
                pasteText = $true
                scroll = $true
                drag = $true
                setValue = $true
                performAction = $true
            }
            surfaces = [pscustomobject]@{ menus = $false; dialogs = $false; dock = $false; menubar = $false }
        }
    }
}

function Test-NightshiftSameRuntimeId($Left, $Right) {
    if ($null -eq $Left -or $null -eq $Right -or $Left.Count -ne $Right.Count) { return $false }
    for ($i = 0; $i -lt $Left.Count; $i++) {
        if ([int]$Left[$i] -ne [int]$Right[$i]) { return $false }
    }
    $true
}

function Find-NightshiftElement($RootElement, $Record) {
    if ($null -eq $Record) { return $null }
    if ($Record.index -eq 0) { return $RootElement }

    try {
        $descendants = $RootElement.FindAll([Windows.Automation.TreeScope]::Descendants, [Windows.Automation.Condition]::TrueCondition)
        for ($i = 0; $i -lt $descendants.Count; $i++) {
            $candidate = $descendants.Item($i)
            if (Test-NightshiftSameRuntimeId @($candidate.GetRuntimeId()) @($Record.runtimeId)) {
                return $candidate
            }
        }
    } catch {}
    $null
}

function Invoke-NightshiftPrimaryAction($Element) {
    foreach ($pattern in @(
        [Windows.Automation.InvokePattern]::Pattern,
        [Windows.Automation.SelectionItemPattern]::Pattern,
        [Windows.Automation.TogglePattern]::Pattern
    )) {
        try {
            $instance = $Element.GetCurrentPattern($pattern)
            if ($pattern -eq [Windows.Automation.InvokePattern]::Pattern) { $instance.Invoke(); return $true }
            if ($pattern -eq [Windows.Automation.SelectionItemPattern]::Pattern) { $instance.Select(); return $true }
            if ($pattern -eq [Windows.Automation.TogglePattern]::Pattern) { $instance.Toggle(); return $true }
        } catch {}
    }
    $false
}

function Invoke-NightshiftNamedAction($Element, [string]$Action) {
    $wanted = ""
    if ($null -ne $Action) { $wanted = $Action.Trim().ToLowerInvariant() }
    switch ($wanted) {
        "invoke" {
            $pattern = $Element.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
            $pattern.Invoke()
            return $true
        }
        "select" {
            $pattern = $Element.GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern)
            $pattern.Select()
            return $true
        }
        "toggle" {
            $pattern = $Element.GetCurrentPattern([Windows.Automation.TogglePattern]::Pattern)
            $pattern.Toggle()
            return $true
        }
        default {
            return $false
        }
    }
}

function Set-NightshiftElementValue($Element, [string]$Value) {
    try {
        $pattern = $Element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
        if (-not $pattern.Current.IsReadOnly) {
            $pattern.SetValue($Value)
            return $true
        }
    } catch {}
    $false
}

function Get-NightshiftRequiredNumber($Value, [string]$Name) {
    if ($null -eq $Value) { throw "$Name is required" }
    $number = [double]$Value
    if ([double]::IsNaN($number) -or [double]::IsInfinity($number)) {
        throw "$Name must be a finite number"
    }
    $number
}

function Get-NightshiftPositiveInteger($Value, [string]$Name) {
    if ($null -eq $Value) { $Value = 1 }
    $number = [int]$Value
    if ($number -le 0) { throw "$Name must be a positive integer" }
    $number
}

function Get-NightshiftPositiveNumber($Value, [string]$Name) {
    if ($null -eq $Value) { $Value = 1 }
    $number = Get-NightshiftRequiredNumber $Value $Name
    if ($number -le 0) { throw "$Name must be a positive number" }
    $number
}

function Get-NightshiftRequiredString($Value, [string]$Name) {
    if ($null -eq $Value) { throw "$Name is required" }
    $text = [string]$Value
    if ($text.Length -eq 0) { throw "$Name is required" }
    $text
}

function Get-NightshiftScreenPoint($Operation, $WindowFrame) {
    if ($null -ne $Operation.element) {
        throw "stale element frame; run get-app-state again and use a fresh element index"
    }
    $x = Get-NightshiftRequiredNumber $Operation.x "x"
    $y = Get-NightshiftRequiredNumber $Operation.y "y"
    @{
        x = [int][Math]::Round($WindowFrame.x + $x)
        y = [int][Math]::Round($WindowFrame.y + $y)
    }
}

function Get-NightshiftElementScreenPoint($Element) {
    if ($null -eq $Element) { return $null }
    try {
        $rect = $Element.Current.BoundingRectangle
        if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
            return @{
                x = [int][Math]::Round($rect.X + ($rect.Width / 2))
                y = [int][Math]::Round($rect.Y + ($rect.Height / 2))
            }
        }
    } catch {}
    $null
}

function Send-NightshiftMouseClick([IntPtr]$WindowHandle, [int]$ScreenX, [int]$ScreenY, [string]$Button, [int]$Count, [string]$Modifiers) {
    [void][NightshiftDesktopWin32]::SetForegroundWindow($WindowHandle)
    [void][NightshiftDesktopWin32]::SetCursorPos($ScreenX, $ScreenY)
    $buttonName = if ([string]::IsNullOrWhiteSpace($Button)) { "left" } else { $Button.ToLowerInvariant() }
    switch ($buttonName) {
        "left" { $down = $MouseEvents.LeftDown; $up = $MouseEvents.LeftUp }
        "right" { $down = $MouseEvents.RightDown; $up = $MouseEvents.RightUp }
        "middle" { $down = $MouseEvents.MiddleDown; $up = $MouseEvents.MiddleUp }
        default { throw "unsupported mouse button: $Button" }
    }

    $modifierKeys = @(Get-NightshiftClickModifierVirtualKeys $Modifiers)
    $clickCount = Get-NightshiftPositiveInteger $Count "click_count"
    if ($modifierKeys.Count -eq 0) {
        for ($i = 0; $i -lt $clickCount; $i++) {
            [NightshiftDesktopWin32]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero)
            Start-Sleep -Milliseconds 35
            [NightshiftDesktopWin32]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero)
        }
        return
    }
    for ($i = 0; $i -lt $clickCount; $i++) {
        [NightshiftDesktopWin32]::SendModifiedClick(
            [byte[]]$modifierKeys,
            [uint32]$down,
            [uint32]$up
        )
        if ($i + 1 -lt $clickCount) { Start-Sleep -Milliseconds 35 }
    }
}

function Send-NightshiftDrag([IntPtr]$WindowHandle, $From, $To) {
    [void][NightshiftDesktopWin32]::SetForegroundWindow($WindowHandle)
    $startX = [int]$From.x
    $startY = [int]$From.y
    $endX = [int]$To.x
    $endY = [int]$To.y
    [void][NightshiftDesktopWin32]::SetCursorPos($startX, $startY)
    [NightshiftDesktopWin32]::mouse_event($MouseEvents.LeftDown, 0, 0, 0, [UIntPtr]::Zero)
    for ($step = 1; $step -le 12; $step++) {
        $x = [int][Math]::Round($startX + (($endX - $startX) * $step / 12))
        $y = [int][Math]::Round($startY + (($endY - $startY) * $step / 12))
        [void][NightshiftDesktopWin32]::SetCursorPos($x, $y)
        Start-Sleep -Milliseconds 20
    }
    [NightshiftDesktopWin32]::mouse_event($MouseEvents.LeftUp, 0, 0, 0, [UIntPtr]::Zero)
}

function Send-NightshiftText([IntPtr]$WindowHandle, [string]$Text) {
    [void][NightshiftDesktopWin32]::SetForegroundWindow($WindowHandle)
    $hasNonAscii = $false
    foreach ($character in $Text.ToCharArray()) {
        if ([int][char]$character -gt 0x7F) { $hasNonAscii = $true; break }
    }
    if ($hasNonAscii) {
        foreach ($character in $Text.ToCharArray()) {
            [void][NightshiftDesktopWin32]::PostMessage($WindowHandle, $WindowsMessages.Char, [IntPtr][int][char]$character, [IntPtr]::Zero)
            Start-Sleep -Milliseconds 8
        }
        return
    }
    [System.Windows.Forms.SendKeys]::SendWait((ConvertTo-NightshiftSendKeysText $Text))
}

function Get-NightshiftVirtualKey([string]$Key) {
    $normalized = $Key.ToLowerInvariant()
    $map = @{
        "return" = 0x0D; "enter" = 0x0D; "tab" = 0x09; "escape" = 0x1B; "esc" = 0x1B
        "backspace" = 0x08; "delete" = 0x2E; "space" = 0x20; "left" = 0x25
        "up" = 0x26; "right" = 0x27; "down" = 0x28; "home" = 0x24; "end" = 0x23
    }
    if ($map.ContainsKey($normalized)) { return $map[$normalized] }
    if ($normalized.Length -eq 1) { return [int][char]$normalized.ToUpperInvariant()[0] }
    throw "Unsupported key: $Key"
}

function Send-NightshiftKey([IntPtr]$WindowHandle, [string]$Key) {
    [void][NightshiftDesktopWin32]::SetForegroundWindow($WindowHandle)
    [System.Windows.Forms.SendKeys]::SendWait((ConvertTo-NightshiftSendKeysKey $Key))
}

function Get-NightshiftModifierVirtualKey([string]$Modifier) {
    switch ($Modifier.ToLowerInvariant()) {
        { $_ -in @("ctrl", "control", "cmdorctrl", "commandorcontrol") } { return 0x11 }
        { $_ -in @("shift") } { return 0x10 }
        { $_ -in @("alt", "option") } { return 0x12 }
        { $_ -in @("meta", "super", "win", "cmd", "command") } { return 0x5B }
        default { throw "Unsupported modifier: $Modifier" }
    }
}

function Get-NightshiftClickModifierVirtualKeys([string]$Modifiers) {
    if ([string]::IsNullOrWhiteSpace($Modifiers)) { return @() }
    $parts = @($Modifiers.Split("+") | ForEach-Object { $_.Trim() })
    $emptyParts = @($parts | Where-Object { [string]::IsNullOrWhiteSpace($_) })
    if ($parts.Count -eq 0 -or $emptyParts.Count -gt 0) {
        throw "Click modifiers require modifier keys only"
    }
    @($parts | ForEach-Object { Get-NightshiftModifierVirtualKey $_ })
}

function Send-NightshiftHotkey([IntPtr]$WindowHandle, [string]$KeySpec) {
    $parts = @($KeySpec.Split("+") | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($parts.Count -eq 0) { throw "Unsupported key: $KeySpec" }
    $key = $parts[$parts.Count - 1]
    $prefix = ""
    if ($parts.Count -gt 1) {
        foreach ($modifier in $parts[0..($parts.Count - 2)]) {
            $prefix += ConvertTo-NightshiftSendKeysModifier $modifier
        }
    }
    [void][NightshiftDesktopWin32]::SetForegroundWindow($WindowHandle)
    [System.Windows.Forms.SendKeys]::SendWait($prefix + (ConvertTo-NightshiftSendKeysKey $key))
}

function ConvertTo-NightshiftSendKeysText([string]$Text) {
    $builder = New-Object System.Text.StringBuilder
    foreach ($character in $Text.ToCharArray()) {
        $value = [string]$character
        if ($value -eq "`r") { continue }
        if ($value -eq "`n") { [void]$builder.Append("{ENTER}"); continue }
        if ("+^%~(){}[]".Contains($value)) {
            [void]$builder.Append("{").Append($value).Append("}")
        } else {
            [void]$builder.Append($value)
        }
    }
    $builder.ToString()
}

function ConvertTo-NightshiftSendKeysKey([string]$Key) {
    switch ($Key.ToLowerInvariant()) {
        { $_ -in @("return", "enter") } { return "{ENTER}" }
        "tab" { return "{TAB}" }
        { $_ -in @("escape", "esc") } { return "{ESC}" }
        "backspace" { return "{BACKSPACE}" }
        "delete" { return "{DELETE}" }
        "space" { return " " }
        "left" { return "{LEFT}" }
        "up" { return "{UP}" }
        "right" { return "{RIGHT}" }
        "down" { return "{DOWN}" }
        "home" { return "{HOME}" }
        "end" { return "{END}" }
        { $_ -in @("pageup", "page_up") } { return "{PGUP}" }
        { $_ -in @("pagedown", "page_down") } { return "{PGDN}" }
        "insert" { return "{INSERT}" }
        default {
            if ($Key.Length -eq 1) { return (ConvertTo-NightshiftSendKeysText $Key) }
            throw "Unsupported key: $Key"
        }
    }
}

function ConvertTo-NightshiftSendKeysModifier([string]$Modifier) {
    switch ($Modifier.ToLowerInvariant()) {
        { $_ -in @("ctrl", "control", "cmdorctrl", "commandorcontrol") } { return "^" }
        "shift" { return "+" }
        { $_ -in @("alt", "option") } { return "%" }
        default { throw "Unsupported modifier: $Modifier" }
    }
}

function Send-NightshiftPasteText([IntPtr]$WindowHandle, [string]$Text) {
    $previous = $null
    $hadPrevious = $false
    try { $previous = [System.Windows.Forms.Clipboard]::GetDataObject() } catch {}
    $hadPrevious = $null -ne $previous
    try {
        Set-Clipboard -Value $Text
        Send-NightshiftHotkey $WindowHandle "Ctrl+v"
    } finally {
        if ($hadPrevious) {
            try { [System.Windows.Forms.Clipboard]::SetDataObject($previous, $true) } catch {}
        } else {
            try { [System.Windows.Forms.Clipboard]::Clear() } catch {}
        }
    }
}

function Invoke-NightshiftOperation($Operation) {
    $includeScreenshot = -not [bool]$Operation.noScreenshot
    if ($Operation.tool -eq "handshake") {
        return [pscustomobject]@{ ok = $true; capabilities = Get-NightshiftHandshake }
    }
    if ($Operation.tool -eq "list_apps") {
        return [pscustomobject]@{ ok = $true; apps = @(Get-NightshiftAppList) }
    }
    if ($Operation.tool -eq "list_windows") {
        $list = Get-NightshiftWindowList $Operation.app
        return [pscustomobject]@{ ok = $true; app = $list.app; windows = @($list.windows) }
    }
    if ($Operation.tool -eq "get_app_state") {
        return [pscustomobject]@{ ok = $true; snapshot = New-NightshiftSnapshot $Operation.app $includeScreenshot $Operation.windowId $Operation.windowIndex ([bool]$Operation.restoreWindow) }
    }

    $process = Find-NightshiftProcess $Operation.app
    if ([bool]$Operation.restoreWindow) { Restore-NightshiftWindow $process }
    Assert-NightshiftWindowTarget $process $Operation.windowId $Operation.windowIndex
    $root = Get-NightshiftRootElement $process
    $windowFrame = if ($null -ne $Operation.windowBounds) { $Operation.windowBounds } else { Get-NightshiftWindowFrame $process $root }
    $element = Find-NightshiftElement $root $Operation.element
    $fromElement = Find-NightshiftElement $root $Operation.fromElement
    $toElement = Find-NightshiftElement $root $Operation.toElement
    $handle = [IntPtr]$process.MainWindowHandle
    if ($Operation.tool -in @("type_text", "press_key", "hotkey", "paste_text")) {
        Assert-NightshiftKeyboardFocus $handle $Operation
    }
    $action = $null

    switch ($Operation.tool) {
        "click" {
            # Why: agents expect a click into a target app to make the next
            # keyboard action safe, even when UI Automation handles the click.
            Restore-NightshiftWindow $process
            $handledByPattern = $false
            $clickCount = Get-NightshiftPositiveInteger $Operation.click_count "click_count"
            $hasModifiers = -not [string]::IsNullOrWhiteSpace([string]$Operation.modifiers)
            if (-not $hasModifiers -and $null -ne $element -and $Operation.mouse_button -ne "right" -and $Operation.mouse_button -ne "middle" -and $clickCount -le 1) {
                $handledByPattern = Invoke-NightshiftPrimaryAction $element
            }
            if (-not $handledByPattern) {
                $point = Get-NightshiftElementScreenPoint $element
                if ($null -eq $point) { $point = Get-NightshiftScreenPoint $Operation $windowFrame }
                Send-NightshiftMouseClick $handle $point.x $point.y $Operation.mouse_button $clickCount $Operation.modifiers
                $action = [pscustomobject]@{ path = "synthetic"; actionName = $null; fallbackReason = "actionUnsupported" }
            } else {
                $action = [pscustomobject]@{ path = "accessibility"; actionName = "primaryAction"; fallbackReason = $null }
            }
        }
        "perform_secondary_action" {
            if ($null -eq $element) { throw "unknown element_index" }
            if (-not (Invoke-NightshiftNamedAction $element $Operation.action)) {
                throw "$($Operation.action) is not a valid secondary action"
            }
            $action = [pscustomobject]@{ path = "accessibility"; actionName = $Operation.action; fallbackReason = $null }
        }
        "scroll" {
            $delta = 120 * [int][Math]::Ceiling((Get-NightshiftPositiveNumber $Operation.pages "pages"))
            $mouseEvent = $MouseEvents.Wheel
            if ($Operation.direction -eq "down") {
                $delta = -1 * $delta
            } elseif ($Operation.direction -eq "left") {
                $mouseEvent = $MouseEvents.HorizontalWheel
                $delta = -1 * $delta
            } elseif ($Operation.direction -eq "right") {
                $mouseEvent = $MouseEvents.HorizontalWheel
            } elseif ($Operation.direction -ne "up") {
                throw "unsupported scroll direction: $($Operation.direction)"
            }
            $point = Get-NightshiftElementScreenPoint $element
            if ($null -eq $point) { $point = Get-NightshiftScreenPoint $Operation $windowFrame }
            [void][NightshiftDesktopWin32]::SetForegroundWindow($handle)
            [void][NightshiftDesktopWin32]::SetCursorPos([int]$point.x, [int]$point.y)
            [NightshiftDesktopWin32]::mouse_event($mouseEvent, 0, 0, $delta, [UIntPtr]::Zero)
            $action = [pscustomobject]@{ path = "synthetic"; actionName = "scroll"; fallbackReason = $null }
        }
        "drag" {
            $from = Get-NightshiftElementScreenPoint $fromElement
            if ($null -eq $from -and $null -ne $Operation.fromElement) { throw "stale element frame; run get-app-state again and use a fresh element index" }
            if ($null -eq $from) {
                $from = @{
                    x = $windowFrame.x + (Get-NightshiftRequiredNumber $Operation.from_x "from_x")
                    y = $windowFrame.y + (Get-NightshiftRequiredNumber $Operation.from_y "from_y")
                }
            }
            $to = Get-NightshiftElementScreenPoint $toElement
            if ($null -eq $to -and $null -ne $Operation.toElement) { throw "stale element frame; run get-app-state again and use a fresh element index" }
            if ($null -eq $to) {
                $to = @{
                    x = $windowFrame.x + (Get-NightshiftRequiredNumber $Operation.to_x "to_x")
                    y = $windowFrame.y + (Get-NightshiftRequiredNumber $Operation.to_y "to_y")
                }
            }
            Send-NightshiftDrag $handle $from $to
            $action = [pscustomobject]@{ path = "synthetic"; actionName = "drag"; fallbackReason = $null }
        }
        "type_text" {
            Send-NightshiftText $handle (Get-NightshiftRequiredString $Operation.text "text")
            $action = [pscustomobject]@{ path = "synthetic"; actionName = "typeText"; fallbackReason = $null; verification = [pscustomobject]@{ state = "unverified"; reason = "synthetic_input" } }
        }
        "press_key" {
            Send-NightshiftKey $handle (Get-NightshiftRequiredString $Operation.key "key")
            $action = [pscustomobject]@{ path = "synthetic"; actionName = "pressKey"; fallbackReason = $null; verification = [pscustomobject]@{ state = "unverified"; reason = "synthetic_input" } }
        }
        "hotkey" {
            Send-NightshiftHotkey $handle (Get-NightshiftRequiredString $Operation.key "key")
            $action = [pscustomobject]@{ path = "synthetic"; actionName = "hotkey"; fallbackReason = $null; verification = [pscustomobject]@{ state = "unverified"; reason = "synthetic_input" } }
        }
        "paste_text" {
            Send-NightshiftPasteText $handle (Get-NightshiftRequiredString $Operation.text "text")
            $action = [pscustomobject]@{ path = "clipboard"; actionName = "paste"; fallbackReason = $null; verification = [pscustomobject]@{ state = "unverified"; reason = "clipboard_paste" } }
        }
        "set_value" {
            if ($null -eq $element -or -not (Set-NightshiftElementValue $element ([string]$Operation.value))) {
                throw "element value is not settable"
            }
            $action = [pscustomobject]@{ path = "accessibility"; actionName = "setValue"; fallbackReason = $null }
        }
        default {
            throw "unsupported tool: $($Operation.tool)"
        }
    }

    try {
        $snapshot = New-NightshiftSnapshot $Operation.app $includeScreenshot $Operation.windowId $Operation.windowIndex
    } catch {
        if ($null -eq $Operation.windowId -and $null -eq $Operation.windowIndex) { throw }
        if ($null -eq $action.verification) {
            $action | Add-Member -NotePropertyName verification -NotePropertyValue ([pscustomobject]@{ state = "unverified"; reason = "window_changed" })
        }
        $snapshot = New-NightshiftSnapshot $Operation.app $includeScreenshot $null $null
    }
    [pscustomobject]@{ ok = $true; action = $action; snapshot = $snapshot }
}

function Invoke-NightshiftServeLoop {
    # Announced before the first read, and after every Add-Type above: a caller
    # that never sees this line knows the helper cannot have read a request, let
    # alone synthesized a click, so replaying it is provably safe. Inferring that
    # from a missing response instead would replay operations that did run.
    [Console]::Out.WriteLine('{"ready":true}')
    [Console]::Out.Flush()
    # One NDJSON request per line in, one response per line out, until stdin closes.
    # Responses carry base64 screenshots and routinely exceed a megabyte; ReadLine
    # and the console writer are both length-bounded only by memory.
    while ($true) {
        $line = [Console]::In.ReadLine()
        if ($null -eq $line) { break }
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $requestId = $null
        try {
            $operation = $line | ConvertFrom-Json
            $requestId = $operation.requestId
            $response = Invoke-NightshiftOperation $operation
        } catch {
            $response = [pscustomobject]@{ ok = $false; error = [string]$_.Exception.Message }
            # ConvertFrom-Json throws before the id is read, so recover it from the
            # raw line. An error the caller can match is delivered to the request
            # that caused it; an unmatched one only trips the caller's desync
            # guard, which kills this helper, charges a failure toward its cooldown
            # and discards the message below - so a malformed request would be
            # reported as a broken stream and its real cause never surface.
            if ($null -eq $requestId -and $line -match '"requestId"\s*:\s*(\d+)') {
                $requestId = [long]$Matches[1]
            }
        }
        # Echoed so the caller can prove which request a line answers; a reply it
        # cannot match is a desynchronised stream, not a usable response.
        if ($null -ne $requestId) {
            $response | Add-Member -NotePropertyName requestId -NotePropertyValue $requestId -Force
        }
        [Console]::Out.WriteLine((ConvertTo-Json $response -Depth 100 -Compress))
        [Console]::Out.Flush()
    }
}

if ($Serve) {
    Invoke-NightshiftServeLoop
} elseif ([string]::IsNullOrWhiteSpace($OperationPath)) {
    Write-NightshiftJson ([pscustomobject]@{ ok = $false; error = "runtime.ps1 requires an operation path or -Serve" })
} else {
    try {
        $operation = Read-NightshiftOperation $OperationPath
        Write-NightshiftJson (Invoke-NightshiftOperation $operation)
    } catch {
        Write-NightshiftJson ([pscustomobject]@{ ok = $false; error = [string]$_.Exception.Message })
    }
}
