#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef SourceDir
  #error SourceDir is required
#endif
#ifndef OutputDir
  #error OutputDir is required
#endif
#ifndef OutputBaseFilename
  #error OutputBaseFilename is required
#endif

#define AppName "枕星AI助手"
#define AppPublisher "ZhenXing AI"
#define MainExeName "枕星AI助手.exe"

[Setup]
AppId={{2DEAF0FA-7B3E-594E-A5DC-B880B184D4A8}
AppName=枕星AI助手
AppVersion={#AppVersion}
AppVerName=枕星AI助手 {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://zhenxingai.com
AppSupportURL=https://zhenxingai.com
AppUpdatesURL=https://zhenxingai.com
DefaultDirName={autopf}\aihub-pc-client
DefaultGroupName=枕星AI助手
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableDirPage=no
DisableReadyPage=yes
DisableFinishedPage=no
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\{#MainExeName}
UninstallDisplayName=枕星AI助手
#ifdef PreviewMode
PrivilegesRequired=lowest
#else
PrivilegesRequired=admin
#endif
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern hidebevels
WizardBackColor=#F4F8FB
WizardSizePercent=100,100
WizardResizable=no
Compression=lzma2/fast
SolidCompression=no
CloseApplications=force
RestartApplications=no
UsePreviousAppDir=yes
UsePreviousTasks=yes
SetupLogging=yes
Uninstallable=yes
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=枕星AI助手 Windows 安装程序
VersionInfoProductName=枕星AI助手
VersionInfoProductVersion={#AppVersion}
VersionInfoCopyright=Copyright (C) 2026 ZhenXing AI

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Messages]
WelcomeLabel1=安装枕星AI助手
WelcomeLabel2=让一颗灰色星芒，随安装进度逐渐点亮。%n%n本向导会为这台电脑上的所有用户安装应用。
SelectDirLabel3=选择枕星AI助手的安装位置，然后点击“下一步”。
InstallingLabel=正在为这台电脑安装枕星AI助手，请稍候。
FinishedHeadingLabel=星光已点亮
FinishedLabel=枕星AI助手已经安装完成。

[Tasks]
Name: "desktopicon"; Description: "在桌面创建枕星AI助手快捷方式"; GroupDescription: "快捷方式："; Flags: checkedonce

[Files]
#ifndef PreviewMode
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
Source: "brand\star-0.png"; Flags: dontcopy
Source: "brand\star-0-twinkle.png"; Flags: dontcopy
Source: "brand\star-1.png"; Flags: dontcopy
Source: "brand\star-1-twinkle.png"; Flags: dontcopy
Source: "brand\star-2.png"; Flags: dontcopy
Source: "brand\star-2-twinkle.png"; Flags: dontcopy
Source: "brand\star-3.png"; Flags: dontcopy
Source: "brand\star-3-twinkle.png"; Flags: dontcopy
Source: "brand\star-4.png"; Flags: dontcopy
Source: "brand\star-4-twinkle.png"; Flags: dontcopy
Source: "brand\star-5.png"; Flags: dontcopy
Source: "brand\star-5-twinkle.png"; Flags: dontcopy
Source: "brand\star-6.png"; Flags: dontcopy
Source: "brand\star-6-twinkle.png"; Flags: dontcopy
Source: "brand\star-7.png"; Flags: dontcopy
Source: "brand\star-7-twinkle.png"; Flags: dontcopy
Source: "brand\star-8.png"; Flags: dontcopy
Source: "brand\star-8-twinkle.png"; Flags: dontcopy
Source: "brand\star-9.png"; Flags: dontcopy
Source: "brand\star-9-twinkle.png"; Flags: dontcopy
Source: "brand\star-10.png"; Flags: dontcopy
Source: "brand\star-10-twinkle.png"; Flags: dontcopy
Source: "brand\star-11.png"; Flags: dontcopy
Source: "brand\star-11-twinkle.png"; Flags: dontcopy
Source: "brand\star-12.png"; Flags: dontcopy
Source: "brand\star-12-twinkle.png"; Flags: dontcopy
Source: "brand\star-13.png"; Flags: dontcopy
Source: "brand\star-13-twinkle.png"; Flags: dontcopy
Source: "brand\star-14.png"; Flags: dontcopy
Source: "brand\star-14-twinkle.png"; Flags: dontcopy
Source: "brand\star-15.png"; Flags: dontcopy
Source: "brand\star-15-twinkle.png"; Flags: dontcopy
Source: "brand\star-16.png"; Flags: dontcopy
Source: "brand\star-16-twinkle.png"; Flags: dontcopy
Source: "brand\star-17.png"; Flags: dontcopy
Source: "brand\star-17-twinkle.png"; Flags: dontcopy
Source: "brand\star-18.png"; Flags: dontcopy
Source: "brand\star-18-twinkle.png"; Flags: dontcopy
Source: "brand\star-19.png"; Flags: dontcopy
Source: "brand\star-19-twinkle.png"; Flags: dontcopy
Source: "brand\star-20.png"; Flags: dontcopy
Source: "brand\star-20-twinkle.png"; Flags: dontcopy
Source: "brand\star-21.png"; Flags: dontcopy
Source: "brand\star-21-twinkle.png"; Flags: dontcopy
Source: "brand\star-22.png"; Flags: dontcopy
Source: "brand\star-22-twinkle.png"; Flags: dontcopy
Source: "brand\star-23.png"; Flags: dontcopy
Source: "brand\star-23-twinkle.png"; Flags: dontcopy
Source: "brand\star-24.png"; Flags: dontcopy
Source: "brand\star-24-twinkle.png"; Flags: dontcopy
Source: "brand\star-25.png"; Flags: dontcopy
Source: "brand\star-25-twinkle.png"; Flags: dontcopy
Source: "brand\star-26.png"; Flags: dontcopy
Source: "brand\star-26-twinkle.png"; Flags: dontcopy
Source: "brand\star-27.png"; Flags: dontcopy
Source: "brand\star-27-twinkle.png"; Flags: dontcopy
Source: "brand\star-28.png"; Flags: dontcopy
Source: "brand\star-28-twinkle.png"; Flags: dontcopy
Source: "brand\star-29.png"; Flags: dontcopy
Source: "brand\star-29-twinkle.png"; Flags: dontcopy
Source: "brand\star-30.png"; Flags: dontcopy
Source: "brand\star-30-twinkle.png"; Flags: dontcopy
Source: "brand\star-31.png"; Flags: dontcopy
Source: "brand\star-31-twinkle.png"; Flags: dontcopy
Source: "brand\progress-track.png"; Flags: dontcopy
Source: "brand\progress-fill.png"; Flags: dontcopy
Source: "brand\star-0.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-0-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-1.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-1-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-2.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-2-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-3.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-3-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-4.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-4-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-5.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-5-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-6.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-6-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-7.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-7-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-8.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-8-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-9.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-9-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-10.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-10-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-11.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-11-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-12.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-12-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-13.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-13-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-14.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-14-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-15.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-15-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-16.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-16-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-17.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-17-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-18.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-18-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-19.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-19-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-20.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-20-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-21.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-21-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-22.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-22-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-23.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-23-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-24.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-24-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-25.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-25-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-26.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-26-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-27.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-27-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-28.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-28-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-29.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-29-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-30.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-30-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-31.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\star-31-twinkle.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\progress-track.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion
Source: "brand\progress-fill.png"; DestDir: "{app}\resources\installer-brand"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\枕星AI助手"; Filename: "{app}\{#MainExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MainExeName}"
Name: "{autodesktop}\枕星AI助手"; Filename: "{app}\{#MainExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MainExeName}"; Tasks: desktopicon

[Run]
#ifndef PreviewMode
Filename: "{app}\{#MainExeName}"; Description: "启动枕星AI助手"; Flags: nowait postinstall skipifsilent runasoriginaluser unchecked
#endif

[Code]
const
  LegacyUninstallKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\2deaf0fa-7b3e-594e-a5dc-b880b184d4a8';
  LegacyUninstallerName = 'Uninstall 枕星AI助手.exe';
  ShellReadyState = 0;
  ShellInstallingState = 1;
  ShellFinishedState = 2;
  ShellUninstallConfirmState = 3;
  ShellUninstallingState = 4;
  ShellUninstallFinishedState = 5;
  BrandFrameCount = 32;
  BrandMaxFrame = BrandFrameCount - 1;
  BrandBrightBaseFrame = 0;
  BrandBreathAmplitude = 31;
  BrandBreathHalfSteps = 32;
  BrandBreathPeakStep = BrandBreathHalfSteps - 1;
  BrandTimerIntervalMs = 80;
  BrandBreathStepTicks = 1;
  BrandBreathCycleSteps = 64;
  BrandTransitionStepTicks = 1;
  GWLStyle = -16;
  GWLExStyle = -20;
  GWLWndProc = -4;
  WSCaption = $00C00000;
  WSThickFrame = $00040000;
  WSSystemMenu = $00080000;
  WSMinimizeBox = $00020000;
  WSMaximizeBox = $00010000;
  SWPNoSize = $0001;
  SWPNoMove = $0002;
  SWPNoZOrder = $0004;
  SWPFrameChanged = $0020;
  WSExLayered = $00080000;
  LWAColorKey = $00000001;
  WMSetRedraw = $000B;
  RDWInvalidate = $0001;
  RDWAllChildren = $0080;
  RDWUpdateNow = $0100;
  WMNCHitTest = $0084;
  HTClient = 1;
  HTCaption = 2;
  TransparentKeyColor = $00FF00FF;

var
  ShellStar: TBitmapImage;
  ShellStarBuffer: TBitmapImage;
  ShellFrame: TPanel;
  ShellPanel: TPanel;
  ShellAccent: TPanel;
  ShellTitle: TNewStaticText;
  ShellDescription: TNewStaticText;
  ShellPathLabel: TNewStaticText;
  ShellProgressText: TNewStaticText;
  ShellProgressTrack: TBitmapImage;
  ShellProgressFill: TBitmapImage;
  ShellLaunchButton: TNewButton;
  ConfirmStar: TBitmapImage;
  ConfirmStarBuffer: TBitmapImage;
  FinishedStar: TBitmapImage;
  FinishedStarBuffer: TBitmapImage;
  UninstallStar: TBitmapImage;
  UninstallStarBuffer: TBitmapImage;
  UninstallFrame: TPanel;
  UninstallPanel: TPanel;
  UninstallAccent: TPanel;
  UninstallTitle: TNewStaticText;
  UninstallDescription: TNewStaticText;
  UninstallProgressText: TNewStaticText;
  UninstallProgressTrack: TBitmapImage;
  UninstallProgressFill: TBitmapImage;
  CurrentInstallFrame: Integer;
  CurrentUninstallFrame: Integer;
  CurrentShellState: Integer;
  AnimationTickCounter: Integer;
  BrandBreathStep: Integer;
  BrandTimerId: UINT_PTR;
  ConfirmTimerId: UINT_PTR;
  FinishedTimerId: UINT_PTR;
  UninstallTimerId: UINT_PTR;
  InstallerAnimationReady: Boolean;
  ConfirmAnimationReady: Boolean;
  FinishedAnimationReady: Boolean;
  UninstallAnimationReady: Boolean;
  WizardOriginalWndProc: Longint;
  ConfirmOriginalWndProc: Longint;
  FinishedOriginalWndProc: Longint;
  UninstallOriginalWndProc: Longint;
  WizardDragHandle: HWND;
  ConfirmDragHandle: HWND;
  FinishedDragHandle: HWND;
  UninstallDragHandle: HWND;

function SetTimer(hWnd: HWND; nIDEvent: UINT_PTR; uElapse: UINT;
  lpTimerFunc: NativeInt): UINT_PTR;
  external 'SetTimer@user32.dll stdcall';
function KillTimer(hWnd: HWND; uIDEvent: UINT_PTR): BOOL;
  external 'KillTimer@user32.dll stdcall';
function GetWindowLong(hWnd: HWND; nIndex: Integer): Longint;
  external 'GetWindowLongW@user32.dll stdcall';
function SetWindowLong(hWnd: HWND; nIndex: Integer;
  dwNewLong: Longint): Longint;
  external 'SetWindowLongW@user32.dll stdcall';
function SetWindowPos(hWnd, hWndInsertAfter: HWND; X, Y, CX, CY: Integer;
  uFlags: UINT): BOOL;
  external 'SetWindowPos@user32.dll stdcall';
function SetLayeredWindowAttributes(hWnd: HWND; ColorKey: TColor;
  Alpha: Byte; Flags: DWORD): BOOL;
  external 'SetLayeredWindowAttributes@user32.dll stdcall';
function CallWindowProc(PreviousProc: Longint; hWnd: HWND; Message: UINT;
  wParam, lParam: Longint): Longint;
  external 'CallWindowProcW@user32.dll stdcall';
function SendMessage(hWnd: HWND; Message: UINT; wParam,
  lParam: Longint): Longint;
  external 'SendMessageW@user32.dll stdcall';
function RedrawWindow(hWnd: HWND; UpdateRect, UpdateRegion: Longint;
  Flags: UINT): BOOL;
  external 'RedrawWindow@user32.dll stdcall';
function GetCursorPos(var Point: TPoint): BOOL;
  external 'GetCursorPos@user32.dll stdcall';
function ScreenToClient(hWnd: HWND; var Point: TPoint): BOOL;
  external 'ScreenToClient@user32.dll stdcall';
function CreateRoundRectRgn(LeftRect, TopRect, RightRect, BottomRect,
  WidthEllipse, HeightEllipse: Integer): THandle;
  external 'CreateRoundRectRgn@gdi32.dll stdcall';
function SetWindowRgn(hWnd: HWND; Region: THandle; Redraw: BOOL): Integer;
  external 'SetWindowRgn@user32.dll stdcall';
function DeleteObject(Handle: THandle): BOOL;
  external 'DeleteObject@gdi32.dll stdcall';

procedure ApplyBorderlessWindow(FormHandle: HWND);
var
  Style: Longint;
begin
  Style := GetWindowLong(FormHandle, GWLStyle);
  Style := Style and not (WSCaption or WSThickFrame or WSSystemMenu or
    WSMinimizeBox or WSMaximizeBox);
  SetWindowLong(FormHandle, GWLStyle, Style);
  SetWindowPos(FormHandle, 0, 0, 0, 0, 0,
    SWPNoSize or SWPNoMove or SWPNoZOrder or SWPFrameChanged);
end;

procedure ApplyTransparentBackdrop(FormHandle: HWND);
var
  Style: Longint;
begin
  Style := GetWindowLong(FormHandle, GWLExStyle);
  SetWindowLong(FormHandle, GWLExStyle, Style or WSExLayered);
  if not SetLayeredWindowAttributes(FormHandle, TransparentKeyColor, 255, LWAColorKey) then
    RaiseException('无法启用安装器透明背景。');
end;

function DraggableWindowProc(hWnd: HWND; Message: UINT;
  wParam, lParam: Longint): Longint;
var
  OriginalProc: Longint;
  Point: TPoint;
begin
  OriginalProc := 0;
  if hWnd = WizardDragHandle then
    OriginalProc := WizardOriginalWndProc
  else if hWnd = ConfirmDragHandle then
    OriginalProc := ConfirmOriginalWndProc
  else if hWnd = FinishedDragHandle then
    OriginalProc := FinishedOriginalWndProc
  else if hWnd = UninstallDragHandle then
    OriginalProc := UninstallOriginalWndProc;
  if OriginalProc = 0 then
  begin
    Result := 0;
    Exit;
  end;
  Result := CallWindowProc(OriginalProc, hWnd, Message, wParam, lParam);
  if (Message = WMNCHitTest) and (Result = HTClient) then
  begin
    if GetCursorPos(Point) then
    begin
      if ScreenToClient(hWnd, Point) then
      begin
        if Point.Y < ScaleY(352) then
          Result := HTCaption;
      end;
    end;
  end;
end;

procedure InstallDragWindowProc(Form: TSetupForm; var OriginalProc: Longint; var FormHandle: HWND);
begin
  FormHandle := Form.Handle;
  OriginalProc := SetWindowLong(FormHandle, GWLWndProc,
    CreateCallback(@DraggableWindowProc));
  if OriginalProc = 0 then
    RaiseException('无法启用安装器窗口拖动。');
end;

procedure RestoreDragWindowProc(var OriginalProc: Longint;
  var FormHandle: HWND);
begin
  if (OriginalProc <> 0) and (FormHandle <> 0) then
    SetWindowLong(FormHandle, GWLWndProc, OriginalProc);
  OriginalProc := 0;
  FormHandle := 0;
end;

procedure ApplyRoundedCorners(Control: TWinControl; Radius: Integer);
var
  Region: THandle;
begin
  Region := CreateRoundRectRgn(0, 0, Control.Width + 1, Control.Height + 1,
    ScaleX(Radius), ScaleY(Radius));
  if Region = 0 then
    RaiseException('无法创建安装器圆角区域。');
  if SetWindowRgn(Control.Handle, Region, True) = 0 then
  begin
    DeleteObject(Region);
    RaiseException('无法应用安装器圆角区域。');
  end;
end;

procedure PrepareRoundedShell(Frame, Panel: TPanel; Parent: TWinControl);
begin
  Frame.Parent := Parent;
  Frame.Left := ScaleX(24);
  Frame.Top := ScaleY(252);
  Frame.Width := ScaleX(472);
  Frame.Height := ScaleY(276);
  Frame.ParentColor := False;
  Frame.ParentBackground := False;
  Frame.Color := $00D6CB9F;
  Frame.BevelOuter := bvNone;
  ApplyRoundedCorners(Frame, 26);

  Panel.Parent := Frame;
  Panel.Left := ScaleX(1);
  Panel.Top := ScaleY(1);
  Panel.Width := ScaleX(470);
  Panel.Height := ScaleY(274);
  Panel.ParentColor := False;
  Panel.ParentBackground := False;
  Panel.Color := $00FEFCF8;
  Panel.BevelOuter := bvNone;
  ApplyRoundedCorners(Panel, 25);
end;

procedure ExtractBrandFrames;
var
  I: Integer;
begin
  for I := 0 to BrandMaxFrame do
  begin
    ExtractTemporaryFile('star-' + IntToStr(I) + '.png');
    ExtractTemporaryFile('star-' + IntToStr(I) + '-twinkle.png');
  end;
  ExtractTemporaryFile('progress-track.png');
  ExtractTemporaryFile('progress-fill.png');
end;

procedure PrepareProgressImage(Image: TBitmapImage; Parent: TWinControl;
  Left, Top, Width, Height: Integer; const FileName: String);
begin
  Image.BackColor := clNone;
  Image.Left := ScaleX(Left);
  Image.Top := ScaleY(Top);
  Image.Width := ScaleX(Width);
  Image.Height := ScaleY(Height);
  Image.Stretch := True;
  Image.Parent := Parent;
  Image.PngImage.LoadFromFile(ExpandConstant('{tmp}\') + FileName);
end;

procedure LoadBrandFrame(Image: TBitmapImage; Frame: Integer;
  Twinkle: Boolean);
var
  FileName: String;
begin
  if Image = nil then
    Exit;
  if Frame < 0 then
    Frame := 0;
  if Frame > BrandMaxFrame then
    Frame := BrandMaxFrame;
  FileName := 'star-' + IntToStr(Frame);
  if Twinkle then
    FileName := FileName + '-twinkle';
  FileName := FileName + '.png';
  FileName := ExpandConstant('{tmp}\') + FileName;
  Image.PngImage.LoadFromFile(FileName);
end;

procedure LoadBrandFrameBuffered(var FrontImage: TBitmapImage;
  var BackImage: TBitmapImage; Frame: Integer);
var
  FileName: String;
  ParentHandle: HWND;
begin
  if (FrontImage = nil) or (BackImage = nil) then
    Exit;
  if Frame < 0 then
    Frame := 0;
  if Frame > BrandMaxFrame then
    Frame := BrandMaxFrame;
  FileName := ExpandConstant('{tmp}\star-') + IntToStr(Frame) + '.png';

  { Decode off-screen first. Then copy to the permanently visible control while
    its parent cannot paint, and issue one complete repaint after the copy. }
  BackImage.PngImage.LoadFromFile(FileName);
  ParentHandle := BackImage.Parent.Handle;
  SendMessage(ParentHandle, WMSetRedraw, 0, 0);
  try
    FrontImage.PngImage.Assign(BackImage.PngImage);
  finally
    SendMessage(ParentHandle, WMSetRedraw, 1, 0);
    RedrawWindow(ParentHandle, 0, 0,
      RDWInvalidate or RDWAllChildren or RDWUpdateNow);
  end;
end;

procedure AdvanceBrandBreath;
begin
  BrandBreathStep := (BrandBreathStep + 1) mod BrandBreathCycleSteps;
end;

function BrandBreathFrame(BaseFrame: Integer): Integer;
var
  Phase: Integer;
begin
  Phase := BrandBreathStep;
  if Phase >= BrandBreathHalfSteps then
    Phase := BrandBreathCycleSteps - 1 - Phase;
  Result := BaseFrame +
    ((Phase * BrandBreathAmplitude) div (BrandBreathHalfSteps - 1));
  if Result > BrandMaxFrame then
    Result := BrandMaxFrame;
end;

function BrandBreathTwinkle: Boolean;
begin
  Result := False;
end;

procedure CacheUninstallFrames;
var
  I: Integer;
  Suffix: String;
  SourceName: String;
  TargetName: String;
begin
  for I := 0 to BrandMaxFrame do
  begin
    Suffix := 'star-' + IntToStr(I) + '.png';
    SourceName := ExpandConstant('{app}\resources\installer-brand\') + Suffix;
    TargetName := ExpandConstant('{tmp}\') + Suffix;
    if not FileCopy(SourceName, TargetName, False) then
      RaiseException('无法准备卸载动画资源：' + Suffix);
    Suffix := 'star-' + IntToStr(I) + '-twinkle.png';
    SourceName := ExpandConstant('{app}\resources\installer-brand\') + Suffix;
    TargetName := ExpandConstant('{tmp}\') + Suffix;
    if not FileCopy(SourceName, TargetName, False) then
      RaiseException('无法准备卸载动画资源：' + Suffix);
  end;
  SourceName := ExpandConstant('{app}\resources\installer-brand\progress-track.png');
  if not FileCopy(SourceName, ExpandConstant('{tmp}\progress-track.png'), False) then
    RaiseException('无法准备卸载进度资源：progress-track.png');
  SourceName := ExpandConstant('{app}\resources\installer-brand\progress-fill.png');
  if not FileCopy(SourceName, ExpandConstant('{tmp}\progress-fill.png'), False) then
    RaiseException('无法准备卸载进度资源：progress-fill.png');
end;

procedure PrepareStarImage(Image: TBitmapImage; Parent: TWinControl;
  Left, Top, Size: Integer);
begin
  Image.BackColor := clNone;
  Image.Left := ScaleX(Left);
  Image.Top := ScaleY(Top);
  Image.Width := ScaleX(Size);
  Image.Height := ScaleY(Size);
  Image.Stretch := True;
  Image.Center := True;
  Image.Parent := Parent;
end;

procedure ApplyInstallStars;
begin
  if CurrentShellState = ShellInstallingState then
  begin
    if CurrentInstallFrame < BrandMaxFrame then
      LoadBrandFrameBuffered(ShellStar, ShellStarBuffer, CurrentInstallFrame)
    else
      LoadBrandFrameBuffered(ShellStar, ShellStarBuffer,
        BrandBreathFrame(BrandBrightBaseFrame));
  end
  else if (CurrentShellState = ShellFinishedState) or
    (CurrentShellState = ShellUninstallConfirmState) then
    LoadBrandFrameBuffered(ShellStar, ShellStarBuffer,
      BrandBreathFrame(BrandBrightBaseFrame))
  else if CurrentShellState = ShellUninstallingState then
  begin
    if CurrentUninstallFrame > 0 then
      LoadBrandFrameBuffered(ShellStar, ShellStarBuffer, CurrentUninstallFrame)
    else
      LoadBrandFrameBuffered(ShellStar, ShellStarBuffer, BrandBreathFrame(0));
  end
  else
    LoadBrandFrameBuffered(ShellStar, ShellStarBuffer, BrandBreathFrame(0));
end;

procedure BrandTimerProc(hWnd: HWND; uMsg: UINT; idEvent: UINT_PTR;
  dwTime: DWORD);
begin
  if not InstallerAnimationReady then
    Exit;
  AnimationTickCounter := AnimationTickCounter + 1;
  if (AnimationTickCounter mod BrandBreathStepTicks) = 0 then
    AdvanceBrandBreath;
  if (CurrentShellState = ShellInstallingState) and
    ((AnimationTickCounter mod BrandTransitionStepTicks) = 0) then
  begin
    if CurrentInstallFrame < BrandMaxFrame then
    begin
      CurrentInstallFrame := CurrentInstallFrame + 1;
      if CurrentInstallFrame = BrandMaxFrame then
        BrandBreathStep := BrandBreathPeakStep;
    end;
  end;
  if (CurrentShellState = ShellUninstallingState) and
    ((AnimationTickCounter mod BrandTransitionStepTicks) = 0) and
    (CurrentUninstallFrame > 0) then
    CurrentUninstallFrame := CurrentUninstallFrame - 1;
  if ((AnimationTickCounter mod BrandBreathStepTicks) = 0) or
    ((AnimationTickCounter mod BrandTransitionStepTicks) = 0) then
    ApplyInstallStars;
end;

procedure BuildCustomInstallerShell;
begin
  WizardForm.ClientWidth := ScaleX(520);
  WizardForm.ClientHeight := ScaleY(552);
  WizardForm.Color := TransparentKeyColor;
  WizardForm.Caption := '枕星AI助手';
  WizardForm.Font.Name := 'Segoe UI';
  ApplyBorderlessWindow(WizardForm.Handle);
  ApplyTransparentBackdrop(WizardForm.Handle);
  InstallDragWindowProc(WizardForm, WizardOriginalWndProc, WizardDragHandle);
  WizardForm.OuterNotebook.Hide;
  WizardForm.InnerNotebook.Hide;
  WizardForm.MainPanel.Hide;
  WizardForm.Bevel.Hide;

  ShellStar := TBitmapImage.Create(WizardForm);
  PrepareStarImage(ShellStar, WizardForm, 150, 24, 220);
  ShellStarBuffer := TBitmapImage.Create(WizardForm);
  PrepareStarImage(ShellStarBuffer, WizardForm, 150, 24, 220);
  ShellStarBuffer.Visible := False;

  ShellFrame := TPanel.Create(WizardForm);
  ShellPanel := TPanel.Create(WizardForm);
  PrepareRoundedShell(ShellFrame, ShellPanel, WizardForm);

  ShellAccent := TPanel.Create(WizardForm);
  ShellAccent.Parent := ShellPanel;
  ShellAccent.Left := ScaleX(40);
  ShellAccent.Top := ScaleY(16);
  ShellAccent.Width := ScaleX(390);
  ShellAccent.Height := ScaleY(2);
  ShellAccent.ParentColor := False;
  ShellAccent.ParentBackground := False;
  ShellAccent.Color := $008B7E08;
  ShellAccent.BevelOuter := bvNone;

  ShellTitle := TNewStaticText.Create(WizardForm);
  ShellTitle.Parent := ShellPanel;
  ShellTitle.Left := ScaleX(28);
  ShellTitle.Top := ScaleY(30);
  ShellTitle.Width := ScaleX(416);
  ShellTitle.Height := ScaleY(32);
  ShellTitle.AutoSize := False;
  ShellTitle.Font.Name := 'Segoe UI';
  ShellTitle.Alignment := taCenter;
  ShellTitle.Font.Size := 14;
  ShellTitle.Font.Style := [fsBold];
  ShellTitle.Font.Color := $0035170A;
  ShellTitle.Color := ShellPanel.Color;

  ShellDescription := TNewStaticText.Create(WizardForm);
  ShellDescription.Parent := ShellPanel;
  ShellDescription.Left := ScaleX(28);
  ShellDescription.Top := ScaleY(68);
  ShellDescription.Width := ScaleX(416);
  ShellDescription.Height := ScaleY(38);
  ShellDescription.AutoSize := False;
  ShellDescription.Font.Name := 'Segoe UI';
  ShellDescription.Font.Size := 9;
  ShellDescription.Alignment := taCenter;
  ShellDescription.Font.Color := $007A6252;
  ShellDescription.Color := ShellPanel.Color;

  ShellPathLabel := TNewStaticText.Create(WizardForm);
  ShellPathLabel.Parent := ShellPanel;
  ShellPathLabel.Left := ScaleX(28);
  ShellPathLabel.Top := ScaleY(110);
  ShellPathLabel.Width := ScaleX(416);
  ShellPathLabel.Height := ScaleY(20);
  ShellPathLabel.AutoSize := False;
  ShellPathLabel.Caption := '安装位置';
  ShellPathLabel.Font.Name := 'Segoe UI';
  ShellPathLabel.Font.Size := 9;
  ShellPathLabel.Font.Style := [fsBold];
  ShellPathLabel.Font.Color := $008B7E08;
  ShellPathLabel.Color := ShellPanel.Color;

  ShellProgressText := TNewStaticText.Create(WizardForm);
  ShellProgressText.Parent := ShellPanel;
  ShellProgressText.Left := ScaleX(380);
  ShellProgressText.Top := ScaleY(127);
  ShellProgressText.Width := ScaleX(64);
  ShellProgressText.Height := ScaleY(24);
  ShellProgressText.AutoSize := False;
  ShellProgressText.Alignment := taRightJustify;
  ShellProgressText.Font.Name := 'Segoe UI';
  ShellProgressText.Font.Size := 10;
  ShellProgressText.Font.Style := [fsBold];
  ShellProgressText.Font.Color := $0035170A;
  ShellProgressText.Color := ShellPanel.Color;

  WizardForm.DirEdit.Parent := ShellPanel;
  WizardForm.DirEdit.Left := ScaleX(28);
  WizardForm.DirEdit.Top := ScaleY(132);
  WizardForm.DirEdit.Width := ScaleX(326);
  WizardForm.DirEdit.Height := ScaleY(26);
  WizardForm.DirBrowseButton.Parent := ShellPanel;
  WizardForm.DirBrowseButton.Left := ScaleX(362);
  WizardForm.DirBrowseButton.Top := ScaleY(130);
  WizardForm.DirBrowseButton.Width := ScaleX(82);
  WizardForm.DirBrowseButton.Height := ScaleY(30);
  WizardForm.DirBrowseButton.Caption := '更改位置';

  WizardForm.StatusLabel.Parent := ShellPanel;
  WizardForm.StatusLabel.Left := ScaleX(28);
  WizardForm.StatusLabel.Top := ScaleY(168);
  WizardForm.StatusLabel.Width := ScaleX(416);
  WizardForm.StatusLabel.Alignment := taCenter;
  WizardForm.StatusLabel.Font.Color := $0035170A;
  WizardForm.StatusLabel.Color := ShellPanel.Color;
  WizardForm.FilenameLabel.Parent := ShellPanel;
  WizardForm.FilenameLabel.Left := ScaleX(28);
  WizardForm.FilenameLabel.Top := ScaleY(190);
  WizardForm.FilenameLabel.Width := ScaleX(416);
  WizardForm.FilenameLabel.Alignment := taCenter;
  WizardForm.FilenameLabel.Font.Color := $007A6252;
  WizardForm.FilenameLabel.Color := ShellPanel.Color;
  WizardForm.ProgressGauge.Parent := ShellPanel;
  WizardForm.ProgressGauge.Left := ScaleX(28);
  WizardForm.ProgressGauge.Top := ScaleY(130);
  WizardForm.ProgressGauge.Width := ScaleX(342);
  WizardForm.ProgressGauge.Height := ScaleY(16);
  ShellProgressTrack := TBitmapImage.Create(WizardForm);
  PrepareProgressImage(ShellProgressTrack, ShellPanel, 28, 130, 342, 16,
    'progress-track.png');
  ShellProgressFill := TBitmapImage.Create(WizardForm);
  PrepareProgressImage(ShellProgressFill, ShellPanel, 30, 132, 1, 12,
    'progress-fill.png');

  WizardForm.RunList.Parent := ShellPanel;
  WizardForm.RunList.Left := ScaleX(28);
  WizardForm.RunList.Top := ScaleY(112);
  WizardForm.RunList.Width := ScaleX(416);
  WizardForm.RunList.Height := ScaleY(50);
  WizardForm.RunList.Color := ShellPanel.Color;
  WizardForm.RunList.Font.Color := $0035170A;

  ShellLaunchButton := TNewButton.Create(WizardForm);
  ShellLaunchButton.Parent := ShellPanel;
  ShellLaunchButton.Left := ScaleX(250);
  ShellLaunchButton.Top := ScaleY(206);
  ShellLaunchButton.Width := ScaleX(194);
  ShellLaunchButton.Height := ScaleY(38);
  ShellLaunchButton.Caption := '打开枕星AI助手';

  WizardForm.NextButton.Parent := ShellPanel;
  WizardForm.NextButton.Left := ScaleX(286);
  WizardForm.NextButton.Top := ScaleY(206);
  WizardForm.NextButton.Width := ScaleX(158);
  WizardForm.NextButton.Height := ScaleY(38);
  WizardForm.NextButton.Default := True;
  WizardForm.CancelButton.Parent := ShellPanel;
  WizardForm.CancelButton.Left := ScaleX(174);
  WizardForm.CancelButton.Top := ScaleY(206);
  WizardForm.CancelButton.Width := ScaleX(100);
  WizardForm.CancelButton.Height := ScaleY(38);
  WizardForm.BackButton.Hide;
end;

procedure ShowInstallerState(State: Integer);
begin
  CurrentShellState := State;
  WizardForm.DirEdit.Visible := False;
  WizardForm.DirBrowseButton.Visible := False;
  WizardForm.StatusLabel.Visible := False;
  WizardForm.FilenameLabel.Visible := False;
  WizardForm.ProgressGauge.Visible := False;
  ShellProgressTrack.Visible := False;
  ShellProgressFill.Visible := False;
  ShellProgressText.Visible := False;
  WizardForm.RunList.Visible := False;
  ShellLaunchButton.Visible := False;
  ShellPathLabel.Visible := False;
  WizardForm.NextButton.Visible := False;
  WizardForm.CancelButton.Visible := False;

  if State = ShellReadyState then
  begin
    ShellTitle.Caption := '准备点亮枕星AI助手';
    ShellDescription.Caption := '选择安装位置，然后开始点亮。';
    ShellPathLabel.Visible := True;
    WizardForm.DirEdit.Visible := True;
    WizardForm.DirBrowseButton.Visible := True;
    WizardForm.NextButton.Caption := '安装';
    WizardForm.NextButton.Left := ScaleX(286);
    WizardForm.NextButton.Width := ScaleX(158);
    WizardForm.NextButton.Visible := True;
    WizardForm.CancelButton.Caption := '取消';
    WizardForm.CancelButton.Visible := True;
    CurrentInstallFrame := 0;
    BrandBreathStep := 0;
  end
  else if State = ShellInstallingState then
  begin
    ShellTitle.Caption := '星光正在点亮';
    ShellDescription.Caption := '正在安装，请保持此窗口开启。';
    WizardForm.StatusLabel.Visible := True;
    WizardForm.FilenameLabel.Visible := True;
    ShellProgressTrack.Visible := True;
    ShellProgressFill.Visible := True;
    ShellProgressFill.Width := ScaleX(1);
    ShellProgressText.Caption := '0%';
    ShellProgressText.Visible := True;
    WizardForm.CancelButton.Caption := '取消安装';
    WizardForm.CancelButton.Visible := True;
    CurrentInstallFrame := 0;
    AnimationTickCounter := 0;
    BrandBreathStep := 0;
  end
  else if State = ShellFinishedState then
  begin
    ShellTitle.Caption := '安装成功';
    ShellDescription.Caption := '星光已点亮，枕星AI助手已经准备就绪。';
    WizardForm.NextButton.Caption := '关闭窗口';
    WizardForm.NextButton.Left := ScaleX(92);
    WizardForm.NextButton.Width := ScaleX(138);
    WizardForm.NextButton.Visible := True;
    ShellLaunchButton.Visible := True;
    CurrentInstallFrame := BrandMaxFrame;
    BrandBreathStep := BrandBreathPeakStep;
  end
  else if State = ShellUninstallConfirmState then
  begin
    ShellTitle.Caption := '确认卸载枕星AI助手';
    ShellDescription.Caption := '将从这台电脑移除枕星AI助手。';
    WizardForm.NextButton.Caption := '确认卸载';
    WizardForm.NextButton.Left := ScaleX(286);
    WizardForm.NextButton.Width := ScaleX(158);
    WizardForm.NextButton.Visible := True;
    WizardForm.CancelButton.Caption := '取消卸载';
    WizardForm.CancelButton.Visible := True;
    CurrentUninstallFrame := BrandMaxFrame;
    BrandBreathStep := BrandBreathPeakStep;
  end
  else if State = ShellUninstallingState then
  begin
    ShellTitle.Caption := '星光正在淡去';
    ShellDescription.Caption := '卸载中…';
    ShellProgressTrack.Visible := True;
    ShellProgressFill.Visible := True;
    ShellProgressFill.Width := ScaleX(142);
    ShellProgressText.Caption := '42%';
    ShellProgressText.Visible := True;
    CurrentUninstallFrame := 6;
    AnimationTickCounter := 0;
    BrandBreathStep := BrandBreathPeakStep;
  end
  else
  begin
    ShellTitle.Caption := '卸载完成，后会有期！';
    ShellDescription.Caption := '';
    WizardForm.NextButton.Caption := '再见！';
    WizardForm.NextButton.Left := ScaleX(185);
    WizardForm.NextButton.Width := ScaleX(100);
    WizardForm.NextButton.Visible := True;
    CurrentUninstallFrame := 0;
    BrandBreathStep := 0;
  end;
  ApplyInstallStars;
end;

procedure LaunchInstalledAppClick(Sender: TObject);
begin
  if WizardForm.RunList.Items.Count > 0 then
    WizardForm.RunList.Checked[0] := True;
  WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure InitializeWizard;
begin
  ExtractBrandFrames;
  BuildCustomInstallerShell;
  ShellLaunchButton.OnClick := @LaunchInstalledAppClick;
  CurrentInstallFrame := 0;
  CurrentUninstallFrame := BrandMaxFrame;
  CurrentShellState := ShellReadyState;
  AnimationTickCounter := 0;
  BrandBreathStep := 0;
  ShowInstallerState(ShellReadyState);
  InstallerAnimationReady := True;
  BrandTimerId := SetTimer(0, 0, BrandTimerIntervalMs, CreateCallback(@BrandTimerProc));
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then
#ifdef PreviewMode
  begin
    if CompareText(ExpandConstant('{param:ZPREVIEW|ready}'), 'installing') = 0 then
      ShowInstallerState(ShellInstallingState)
    else if CompareText(ExpandConstant('{param:ZPREVIEW|ready}'), 'finished') = 0 then
      ShowInstallerState(ShellFinishedState)
    else if CompareText(ExpandConstant('{param:ZPREVIEW|ready}'), 'uninstall-confirm') = 0 then
      ShowInstallerState(ShellUninstallConfirmState)
    else if CompareText(ExpandConstant('{param:ZPREVIEW|ready}'), 'uninstalling') = 0 then
      ShowInstallerState(ShellUninstallingState)
    else if CompareText(ExpandConstant('{param:ZPREVIEW|ready}'), 'uninstall-finished') = 0 then
      ShowInstallerState(ShellUninstallFinishedState)
    else
      ShowInstallerState(ShellReadyState);
  end
#else
    ShowInstallerState(ShellReadyState)
#endif
  else if CurPageID = wpInstalling then
    ShowInstallerState(ShellInstallingState)
  else if CurPageID = wpFinished then
    ShowInstallerState(ShellFinishedState);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := PageID = wpSelectTasks;
end;

procedure CurInstallProgressChanged(CurProgress, MaxProgress: Integer);
begin
  if MaxProgress > 0 then
  begin
    ShellProgressText.Caption := IntToStr((CurProgress * 100) div MaxProgress) + '%';
    ShellProgressFill.Width := ScaleX((338 * CurProgress) div MaxProgress);
  end
  else
  begin
    ShellProgressText.Caption := '0%';
    ShellProgressFill.Width := ScaleX(1);
  end;
  ApplyInstallStars;
end;

function ParseLegacyCommand(const Command: String;
  var LegacyExe, LegacyArgs: String): Boolean;
var
  ClosingQuote: Integer;
begin
  Result := False;
  if (Length(Command) < 4) or (Command[1] <> '"') then
    Exit;
  ClosingQuote := Pos('"', Copy(Command, 2, Length(Command) - 1));
  if ClosingQuote = 0 then
    Exit;
  ClosingQuote := ClosingQuote + 1;
  LegacyExe := Copy(Command, 2, ClosingQuote - 2);
  LegacyArgs := Trim(Copy(Command, ClosingQuote + 1, Length(Command)));
  Result := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  LegacyCommand: String;
  LegacyExe: String;
  LegacyArgs: String;
  ResultCode: Integer;
begin
  Result := '';
#ifdef PreviewMode
  Result := '这是安装器视觉预览，不会写入系统。';
  Exit;
#endif
  if not RegKeyExists(HKLM64, LegacyUninstallKey) then
    Exit;
  if not RegQueryStringValue(HKLM64, LegacyUninstallKey, 'QuietUninstallString',
    LegacyCommand) then
  begin
    Result := '检测到旧版枕星AI助手，但未找到安全卸载命令。安装已停止。';
    Exit;
  end;
  if not ParseLegacyCommand(LegacyCommand, LegacyExe, LegacyArgs) then
  begin
    Result := '旧版卸载命令格式无法验证。安装已停止。';
    Exit;
  end;
  if (ExtractFileDrive(LegacyExe) = '') or
    (CompareText(ExtractFileName(LegacyExe), LegacyUninstallerName) <> 0) or
    (CompareText(LegacyArgs, '/allusers /S') <> 0) or
    (not FileExists(LegacyExe)) then
  begin
    Result := '旧版卸载程序身份无法验证。安装已停止。';
    Exit;
  end;
  if (not Exec(LegacyExe, LegacyArgs, '', SW_SHOWNORMAL, ewWaitUntilTerminated,
    ResultCode)) or (ResultCode <> 0) then
  begin
    Result := '旧版枕星AI助手未能安全卸载。安装已停止。';
    Exit;
  end;
  if RegKeyExists(HKLM64, LegacyUninstallKey) then
    Result := '旧版卸载记录仍然存在。为避免两个版本并存，安装已停止。';
end;

procedure DeinitializeSetup;
begin
  InstallerAnimationReady := False;
  if BrandTimerId <> 0 then
  begin
    KillTimer(0, BrandTimerId);
    BrandTimerId := 0;
  end;
  RestoreDragWindowProc(WizardOriginalWndProc, WizardDragHandle);
end;

procedure UninstallTimerProc(hWnd: HWND; uMsg: UINT; idEvent: UINT_PTR;
  dwTime: DWORD);
var
  ProgressPercent: Integer;
begin
  if not UninstallAnimationReady then
    Exit;
  AnimationTickCounter := AnimationTickCounter + 1;
  if (AnimationTickCounter mod BrandBreathStepTicks) = 0 then
    AdvanceBrandBreath;
  if ((AnimationTickCounter mod BrandTransitionStepTicks) = 0) and
    (CurrentUninstallFrame > 0) then
    CurrentUninstallFrame := CurrentUninstallFrame - 1;
  if ((AnimationTickCounter mod BrandBreathStepTicks) = 0) or
    ((AnimationTickCounter mod BrandTransitionStepTicks) = 0) then
  begin
    if CurrentUninstallFrame > 0 then
      LoadBrandFrameBuffered(UninstallStar, UninstallStarBuffer,
        CurrentUninstallFrame)
    else
      LoadBrandFrameBuffered(UninstallStar, UninstallStarBuffer,
        BrandBreathFrame(0));
  end;
  ProgressPercent := 0;
  if UninstallProgressForm.ProgressBar.Max > 0 then
    ProgressPercent := (UninstallProgressForm.ProgressBar.Position * 100) div
      UninstallProgressForm.ProgressBar.Max;
  UninstallProgressText.Caption := IntToStr(ProgressPercent) + '%';
  if ProgressPercent > 0 then
    UninstallProgressFill.Width := ScaleX((328 * ProgressPercent) div 100)
  else
    UninstallProgressFill.Width := ScaleX(1);
end;

procedure ConfirmTimerProc(hWnd: HWND; uMsg: UINT; idEvent: UINT_PTR;
  dwTime: DWORD);
begin
  if not ConfirmAnimationReady then
    Exit;
  AnimationTickCounter := AnimationTickCounter + 1;
  if (AnimationTickCounter mod BrandBreathStepTicks) = 0 then
  begin
    AdvanceBrandBreath;
    LoadBrandFrameBuffered(ConfirmStar, ConfirmStarBuffer,
      BrandBreathFrame(BrandBrightBaseFrame));
  end;
end;

procedure FinishedTimerProc(hWnd: HWND; uMsg: UINT; idEvent: UINT_PTR;
  dwTime: DWORD);
begin
  if not FinishedAnimationReady then
    Exit;
  AnimationTickCounter := AnimationTickCounter + 1;
  if (AnimationTickCounter mod BrandBreathStepTicks) = 0 then
  begin
    AdvanceBrandBreath;
    LoadBrandFrameBuffered(FinishedStar, FinishedStarBuffer,
      BrandBreathFrame(0));
  end;
end;

function ShowCustomUninstallConfirmation: Boolean;
var
  ConfirmForm: TSetupForm;
  ConfirmFrame: TPanel;
  ConfirmPanel: TPanel;
  ConfirmAccent: TPanel;
  ConfirmTitle: TNewStaticText;
  ConfirmText: TNewStaticText;
  ConfirmButton: TNewButton;
  CancelButton: TNewButton;
begin
  ConfirmForm := CreateCustomForm(ScaleX(520), ScaleY(552), False, True);
  try
    ConfirmForm.Caption := '卸载枕星AI助手';
    ConfirmForm.Color := TransparentKeyColor;
    ConfirmForm.Font.Name := 'Segoe UI';
    ApplyBorderlessWindow(ConfirmForm.Handle);
    ApplyTransparentBackdrop(ConfirmForm.Handle);
    InstallDragWindowProc(ConfirmForm, ConfirmOriginalWndProc, ConfirmDragHandle);

    ConfirmStar := TBitmapImage.Create(ConfirmForm);
    PrepareStarImage(ConfirmStar, ConfirmForm, 150, 24, 220);
    LoadBrandFrame(ConfirmStar, BrandMaxFrame, False);
    ConfirmStarBuffer := TBitmapImage.Create(ConfirmForm);
    PrepareStarImage(ConfirmStarBuffer, ConfirmForm, 150, 24, 220);
    ConfirmStarBuffer.Visible := False;

    ConfirmFrame := TPanel.Create(ConfirmForm);
    ConfirmPanel := TPanel.Create(ConfirmForm);
    PrepareRoundedShell(ConfirmFrame, ConfirmPanel, ConfirmForm);
    ConfirmAccent := TPanel.Create(ConfirmForm);
    ConfirmAccent.Parent := ConfirmPanel;
    ConfirmAccent.Left := ScaleX(40);
    ConfirmAccent.Top := ScaleY(16);
    ConfirmAccent.Width := ScaleX(390);
    ConfirmAccent.Height := ScaleY(2);
    ConfirmAccent.ParentColor := False;
    ConfirmAccent.ParentBackground := False;
    ConfirmAccent.Color := $008B7E08;
    ConfirmAccent.BevelOuter := bvNone;

    ConfirmTitle := TNewStaticText.Create(ConfirmForm);
    ConfirmTitle.Parent := ConfirmPanel;
    ConfirmTitle.Left := ScaleX(28);
    ConfirmTitle.Top := ScaleY(42);
    ConfirmTitle.Width := ScaleX(414);
    ConfirmTitle.Height := ScaleY(34);
    ConfirmTitle.AutoSize := False;
    ConfirmTitle.Alignment := taCenter;
    ConfirmTitle.Caption := '确认卸载枕星AI助手？';
    ConfirmTitle.Font.Name := 'Segoe UI';
    ConfirmTitle.Font.Size := 15;
    ConfirmTitle.Font.Style := [fsBold];
    ConfirmTitle.Font.Color := $0035170A;
    ConfirmTitle.Color := ConfirmPanel.Color;

    ConfirmText := TNewStaticText.Create(ConfirmForm);
    ConfirmText.Parent := ConfirmPanel;
    ConfirmText.Left := ScaleX(28);
    ConfirmText.Top := ScaleY(92);
    ConfirmText.Width := ScaleX(414);
    ConfirmText.Height := ScaleY(44);
    ConfirmText.AutoSize := False;
    ConfirmText.Alignment := taCenter;
    ConfirmText.Caption := '卸载后，本机应用文件将被移除。';
    ConfirmText.Font.Name := 'Segoe UI';
    ConfirmText.Font.Size := 10;
    ConfirmText.Font.Color := $007A6252;
    ConfirmText.Color := ConfirmPanel.Color;

    CancelButton := TNewButton.Create(ConfirmForm);
    CancelButton.Parent := ConfirmPanel;
    CancelButton.Left := ScaleX(86);
    CancelButton.Top := ScaleY(198);
    CancelButton.Width := ScaleX(132);
    CancelButton.Height := ScaleY(38);
    CancelButton.Caption := '取消卸载';
    CancelButton.ModalResult := mrCancel;
    CancelButton.Cancel := True;

    ConfirmButton := TNewButton.Create(ConfirmForm);
    ConfirmButton.Parent := ConfirmPanel;
    ConfirmButton.Left := ScaleX(252);
    ConfirmButton.Top := ScaleY(198);
    ConfirmButton.Width := ScaleX(132);
    ConfirmButton.Height := ScaleY(38);
    ConfirmButton.Caption := '确认卸载';
    ConfirmButton.ModalResult := mrOk;
    ConfirmButton.Default := True;
    ConfirmForm.ActiveControl := CancelButton;

    AnimationTickCounter := 0;
    BrandBreathStep := BrandBreathPeakStep;
    ConfirmAnimationReady := True;
    ConfirmTimerId := SetTimer(0, 0, BrandTimerIntervalMs, CreateCallback(@ConfirmTimerProc));
    Result := ConfirmForm.ShowModal() = mrOk;
  finally
    ConfirmAnimationReady := False;
    if ConfirmTimerId <> 0 then
    begin
      KillTimer(0, ConfirmTimerId);
      ConfirmTimerId := 0;
    end;
    RestoreDragWindowProc(ConfirmOriginalWndProc, ConfirmDragHandle);
    ConfirmStar := nil;
    ConfirmStarBuffer := nil;
    ConfirmForm.Free();
  end;
end;

function InitializeUninstall: Boolean;
var
  ResultCode: Integer;
begin
  CacheUninstallFrames;
  if CompareText(ExpandConstant('{param:ZCONFIRMED|0}'), '1') = 0 then
  begin
    Result := True;
    Exit;
  end;

  Result := False;
  if not ShowCustomUninstallConfirmation then
    Exit;
  if not Exec(ExpandConstant('{uninstallexe}'), '/SILENT /ZCONFIRMED=1', '',
    SW_SHOWNORMAL, ewNoWait, ResultCode) then
    MsgBox('无法启动卸载程序，请稍后重试。', mbError, MB_OK);
end;

procedure BuildCustomUninstallerShell;
begin
  UninstallProgressForm.ClientWidth := ScaleX(520);
  UninstallProgressForm.ClientHeight := ScaleY(552);
  UninstallProgressForm.Color := TransparentKeyColor;
  UninstallProgressForm.Caption := '卸载枕星AI助手';
  UninstallProgressForm.Font.Name := 'Segoe UI';
  ApplyBorderlessWindow(UninstallProgressForm.Handle);
  ApplyTransparentBackdrop(UninstallProgressForm.Handle);
  InstallDragWindowProc(UninstallProgressForm, UninstallOriginalWndProc, UninstallDragHandle);
  UninstallProgressForm.PageNameLabel.Hide;
  UninstallProgressForm.PageDescriptionLabel.Hide;

  UninstallStar := TBitmapImage.Create(UninstallProgressForm);
  PrepareStarImage(UninstallStar, UninstallProgressForm, 150, 24, 220);
  UninstallStarBuffer := TBitmapImage.Create(UninstallProgressForm);
  PrepareStarImage(UninstallStarBuffer, UninstallProgressForm, 150, 24, 220);
  UninstallStarBuffer.Visible := False;

  UninstallFrame := TPanel.Create(UninstallProgressForm);
  UninstallPanel := TPanel.Create(UninstallProgressForm);
  PrepareRoundedShell(UninstallFrame, UninstallPanel, UninstallProgressForm);
  UninstallAccent := TPanel.Create(UninstallProgressForm);
  UninstallAccent.Parent := UninstallPanel;
  UninstallAccent.Left := ScaleX(40);
  UninstallAccent.Top := ScaleY(16);
  UninstallAccent.Width := ScaleX(390);
  UninstallAccent.Height := ScaleY(2);
  UninstallAccent.ParentColor := False;
  UninstallAccent.ParentBackground := False;
  UninstallAccent.Color := $008B7E08;
  UninstallAccent.BevelOuter := bvNone;

  UninstallTitle := TNewStaticText.Create(UninstallProgressForm);
  UninstallTitle.Parent := UninstallPanel;
  UninstallTitle.Left := ScaleX(28);
  UninstallTitle.Top := ScaleY(42);
  UninstallTitle.Width := ScaleX(414);
  UninstallTitle.Height := ScaleY(34);
  UninstallTitle.AutoSize := False;
  UninstallTitle.Alignment := taCenter;
  UninstallTitle.Caption := '星光正在淡去';
  UninstallTitle.Font.Name := 'Segoe UI';
  UninstallTitle.Font.Size := 15;
  UninstallTitle.Font.Style := [fsBold];
  UninstallTitle.Font.Color := $0035170A;
  UninstallTitle.Color := UninstallPanel.Color;

  UninstallDescription := TNewStaticText.Create(UninstallProgressForm);
  UninstallDescription.Parent := UninstallPanel;
  UninstallDescription.Left := ScaleX(28);
  UninstallDescription.Top := ScaleY(84);
  UninstallDescription.Width := ScaleX(414);
  UninstallDescription.Height := ScaleY(30);
  UninstallDescription.AutoSize := False;
  UninstallDescription.Alignment := taCenter;
  UninstallDescription.Caption := '卸载中…';
  UninstallDescription.Font.Name := 'Segoe UI';
  UninstallDescription.Font.Size := 10;
  UninstallDescription.Font.Color := $007A6252;
  UninstallDescription.Color := UninstallPanel.Color;

  UninstallProgressText := TNewStaticText.Create(UninstallProgressForm);
  UninstallProgressText.Parent := UninstallPanel;
  UninstallProgressText.Left := ScaleX(382);
  UninstallProgressText.Top := ScaleY(126);
  UninstallProgressText.Width := ScaleX(60);
  UninstallProgressText.Height := ScaleY(24);
  UninstallProgressText.AutoSize := False;
  UninstallProgressText.Alignment := taRightJustify;
  UninstallProgressText.Caption := '0%';
  UninstallProgressText.Font.Name := 'Segoe UI';
  UninstallProgressText.Font.Size := 10;
  UninstallProgressText.Font.Style := [fsBold];
  UninstallProgressText.Font.Color := $0035170A;
  UninstallProgressText.Color := UninstallPanel.Color;

  UninstallProgressForm.ProgressBar.Parent := UninstallPanel;
  UninstallProgressForm.ProgressBar.Left := ScaleX(40);
  UninstallProgressForm.ProgressBar.Top := ScaleY(130);
  UninstallProgressForm.ProgressBar.Width := ScaleX(332);
  UninstallProgressForm.ProgressBar.Height := ScaleY(18);
  UninstallProgressForm.ProgressBar.Visible := False;
  UninstallProgressTrack := TBitmapImage.Create(UninstallProgressForm);
  PrepareProgressImage(UninstallProgressTrack, UninstallPanel, 40, 130, 332, 16,
    'progress-track.png');
  UninstallProgressFill := TBitmapImage.Create(UninstallProgressForm);
  PrepareProgressImage(UninstallProgressFill, UninstallPanel, 42, 132, 1, 12,
    'progress-fill.png');
  UninstallProgressForm.StatusLabel.Parent := UninstallPanel;
  UninstallProgressForm.StatusLabel.Left := ScaleX(28);
  UninstallProgressForm.StatusLabel.Top := ScaleY(170);
  UninstallProgressForm.StatusLabel.Width := ScaleX(414);
  UninstallProgressForm.StatusLabel.Alignment := taCenter;
  UninstallProgressForm.StatusLabel.Font.Color := $007A6252;
  UninstallProgressForm.StatusLabel.Color := UninstallPanel.Color;
  UninstallProgressForm.CancelButton.Parent := UninstallPanel;
  UninstallProgressForm.CancelButton.Visible := False;
end;

procedure InitializeUninstallProgressForm;
begin
  CacheUninstallFrames;
  BuildCustomUninstallerShell;
  CurrentUninstallFrame := BrandMaxFrame;
  AnimationTickCounter := 0;
  LoadBrandFrame(UninstallStar, CurrentUninstallFrame, False);
  BrandBreathStep := BrandBreathPeakStep;
  UninstallAnimationReady := True;
  UninstallTimerId := SetTimer(0, 0, BrandTimerIntervalMs, CreateCallback(@UninstallTimerProc));
end;

procedure ShowUninstallFinished;
var
  FinishedForm: TSetupForm;
  FinishedFrame: TPanel;
  FinishedPanel: TPanel;
  FinishedAccent: TPanel;
  FinishedText: TNewStaticText;
  GoodbyeButton: TNewButton;
begin
  FinishedForm := CreateCustomForm(ScaleX(520), ScaleY(552), False, True);
  try
    FinishedForm.Caption := '枕星AI助手已卸载';
    FinishedForm.Color := TransparentKeyColor;
    FinishedForm.Font.Name := 'Segoe UI';
    ApplyBorderlessWindow(FinishedForm.Handle);
    ApplyTransparentBackdrop(FinishedForm.Handle);
    InstallDragWindowProc(FinishedForm, FinishedOriginalWndProc, FinishedDragHandle);

    FinishedStar := TBitmapImage.Create(FinishedForm);
    PrepareStarImage(FinishedStar, FinishedForm, 150, 24, 220);
    LoadBrandFrame(FinishedStar, 0, False);
    FinishedStarBuffer := TBitmapImage.Create(FinishedForm);
    PrepareStarImage(FinishedStarBuffer, FinishedForm, 150, 24, 220);
    FinishedStarBuffer.Visible := False;

    FinishedFrame := TPanel.Create(FinishedForm);
    FinishedPanel := TPanel.Create(FinishedForm);
    PrepareRoundedShell(FinishedFrame, FinishedPanel, FinishedForm);
    FinishedAccent := TPanel.Create(FinishedForm);
    FinishedAccent.Parent := FinishedPanel;
    FinishedAccent.Left := ScaleX(40);
    FinishedAccent.Top := ScaleY(16);
    FinishedAccent.Width := ScaleX(390);
    FinishedAccent.Height := ScaleY(2);
    FinishedAccent.ParentColor := False;
    FinishedAccent.ParentBackground := False;
    FinishedAccent.Color := $008B7E08;
    FinishedAccent.BevelOuter := bvNone;

    FinishedText := TNewStaticText.Create(FinishedForm);
    FinishedText.Parent := FinishedPanel;
    FinishedText.Left := ScaleX(28);
    FinishedText.Top := ScaleY(72);
    FinishedText.Width := ScaleX(414);
    FinishedText.Height := ScaleY(40);
    FinishedText.AutoSize := False;
    FinishedText.Alignment := taCenter;
    FinishedText.Caption := '卸载完成，后会有期！';
    FinishedText.Font.Name := 'Segoe UI';
    FinishedText.Font.Size := 15;
    FinishedText.Font.Style := [fsBold];
    FinishedText.Font.Color := $0035170A;
    FinishedText.Color := FinishedPanel.Color;

    GoodbyeButton := TNewButton.Create(FinishedForm);
    GoodbyeButton.Parent := FinishedPanel;
    GoodbyeButton.Left := ScaleX(185);
    GoodbyeButton.Top := ScaleY(182);
    GoodbyeButton.Width := ScaleX(100);
    GoodbyeButton.Height := ScaleY(40);
    GoodbyeButton.Caption := '再见！';
    GoodbyeButton.ModalResult := mrOk;
    GoodbyeButton.Default := True;
    FinishedForm.ActiveControl := GoodbyeButton;

    AnimationTickCounter := 0;
    BrandBreathStep := 0;
    FinishedAnimationReady := True;
    FinishedTimerId := SetTimer(0, 0, BrandTimerIntervalMs, CreateCallback(@FinishedTimerProc));
    FinishedForm.ShowModal();
  finally
    FinishedAnimationReady := False;
    if FinishedTimerId <> 0 then
    begin
      KillTimer(0, FinishedTimerId);
      FinishedTimerId := 0;
    end;
    RestoreDragWindowProc(FinishedOriginalWndProc, FinishedDragHandle);
    FinishedStar := nil;
    FinishedStarBuffer := nil;
    FinishedForm.Free();
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    CurrentUninstallFrame := BrandMaxFrame;
    if UninstallAnimationReady then
      LoadBrandFrameBuffered(UninstallStar, UninstallStarBuffer,
        CurrentUninstallFrame);
  end
  else if CurUninstallStep = usPostUninstall then
  begin
    CurrentUninstallFrame := 0;
    if UninstallAnimationReady then
      LoadBrandFrameBuffered(UninstallStar, UninstallStarBuffer,
        CurrentUninstallFrame);
  end
  else if CurUninstallStep = usDone then
  begin
    CurrentUninstallFrame := 0;
    if UninstallAnimationReady then
      LoadBrandFrameBuffered(UninstallStar, UninstallStarBuffer,
        CurrentUninstallFrame);
    UninstallAnimationReady := False;
    if UninstallTimerId <> 0 then
    begin
      KillTimer(0, UninstallTimerId);
      UninstallTimerId := 0;
    end;
    UninstallProgressForm.Hide;
    ShowUninstallFinished;
  end;
end;

procedure DeinitializeUninstall;
begin
  ConfirmAnimationReady := False;
  FinishedAnimationReady := False;
  UninstallAnimationReady := False;
  if ConfirmTimerId <> 0 then
  begin
    KillTimer(0, ConfirmTimerId);
    ConfirmTimerId := 0;
  end;
  if FinishedTimerId <> 0 then
  begin
    KillTimer(0, FinishedTimerId);
    FinishedTimerId := 0;
  end;
  if UninstallTimerId <> 0 then
  begin
    KillTimer(0, UninstallTimerId);
    UninstallTimerId := 0;
  end;
  RestoreDragWindowProc(ConfirmOriginalWndProc, ConfirmDragHandle);
  RestoreDragWindowProc(FinishedOriginalWndProc, FinishedDragHandle);
  RestoreDragWindowProc(UninstallOriginalWndProc, UninstallDragHandle);
end;
