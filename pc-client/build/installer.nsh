!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

!define MUI_BGCOLOR "071421"
!define MUI_TEXTCOLOR "E2E8EE"
!define MUI_INSTFILESPAGE_COLORS "E2E8EE 122A3B"
!define BRAND_STAR_STATIC_STYLE 0x5000020E

!ifndef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_GUIINIT BrandInstallerGuiInit
!else
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.BrandUninstallerGuiInit
!endif
!ifndef PBM_GETRANGE
  !define PBM_GETRANGE 0x0407
!endif

Var BrandWindowIconSmall
Var BrandWindowIconLarge
Var BrandFrameBitmap
Var BrandStarControl
Var BrandLastFrame
Var BrandRequestedFrame
Var BrandProgressLayoutApplied
Var BrandDirectoryLayoutApplied
Var BrandTwinklePhase
Var BrandTwinkleTick

!macro BrandEmbedAssets
  InitPluginsDir
  File /oname=$PLUGINSDIR\brand-window.ico "${BUILD_RESOURCES_DIR}\icon.ico"
  File /oname=$PLUGINSDIR\brand-star-shell-0.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-0.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-1.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-1.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-2.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-2.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-3.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-3.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-4.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-4.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-5.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-5.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-6.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-6.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-7.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-7.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-0-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-0-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-1-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-1-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-2-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-2-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-3-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-3-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-4-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-4-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-5-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-5-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-6-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-6-twinkle.bmp"
  File /oname=$PLUGINSDIR\brand-star-shell-7-twinkle.bmp "${BUILD_RESOURCES_DIR}\installer-brand\star-shell-7-twinkle.bmp"
!macroend

!macro customHeader
  BrandingText "枕星AI助手"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "枕星AI助手"
  !define MUI_WELCOMEPAGE_TEXT "让一颗灰色星芒，随安装进度逐渐点亮。"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandWelcomeShow
  !insertmacro MUI_PAGE_WELCOME
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandDirectoryShow
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandProgressShow
!macroend

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif
  !define MUI_FINISHPAGE_TITLE "星光已点亮"
  !define MUI_FINISHPAGE_TEXT "枕星AI助手已安装完成。"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandFinishShow
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "枕星AI助手"
  !define MUI_WELCOMEPAGE_TEXT "星光将随卸载进度慢慢归于沉静。"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.BrandWelcomeShow
  !insertmacro MUI_UNPAGE_WELCOME
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.BrandProgressShow
!macroend

!macro customUninstallPage
  !define MUI_FINISHPAGE_TITLE "星光已归于沉静"
  !define MUI_FINISHPAGE_TEXT "枕星AI助手已从这台电脑移除。"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.BrandFinishShow
!macroend

!macro customInit
  !insertmacro BrandEmbedAssets
!macroend

!macro customUnInit
  !insertmacro BrandEmbedAssets
!macroend

!macro BrandShapeWindowBody
  System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i-16) i.r4'
  IntOp $5 $4 & 0xFF30FFFF
  IntOp $5 $5 | 0x80000000
  System::Call 'user32::SetWindowLongW(p $HWNDPARENT, i-16, i r5) i.r4'
  System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i-20) i.r4'
  IntOp $5 $4 | 0x00080000
  System::Call 'user32::SetWindowLongW(p $HWNDPARENT, i-20, i r5) i.r4'
  System::Call 'user32::GetSystemMetrics(i0) i.r0'
  System::Call 'user32::GetSystemMetrics(i1) i.r1'
  IntOp $2 $0 - 620
  IntOp $2 $2 / 2
  IntOp $3 $1 - 620
  IntOp $3 $3 / 2
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p0, i r2, i r3, i620, i620, i0x0020)'
  System::Call 'user32::SetLayeredWindowAttributes(p $HWNDPARENT, i0x00211407, i255, i1) i.r6'
!macroend

!macro BrandPrepareStarPageBody
  FindWindow $0 "#32770" "" $HWNDPARENT
  System::Call 'user32::SetWindowPos(p r0, p0, i0, i0, i620, i620, i0x0004)'
  System::Call 'user32::CreateWindowExW(i0, w"STATIC", w"", i${BRAND_STAR_STATIC_STYLE}, i0, i0, i620, i620, p r0, p0, p0, p0) p.r1'
  StrCpy $BrandStarControl $1
  System::Call 'user32::SetWindowPos(p r1, p1, i0, i0, i620, i620, i0x0010)'
  StrCpy $BrandLastFrame -1
  GetDlgItem $2 $HWNDPARENT 1037
  ShowWindow $2 ${SW_HIDE}
  GetDlgItem $2 $HWNDPARENT 1038
  ShowWindow $2 ${SW_HIDE}
  GetDlgItem $2 $HWNDPARENT 1046
  ShowWindow $2 ${SW_HIDE}
!macroend

!macro BrandPositionButtonsBody
  GetDlgItem $6 $HWNDPARENT 3
  System::Call 'user32::SetWindowPos(p r6, p0, i184, i540, i82, i32, i0x0004)'
  GetDlgItem $7 $HWNDPARENT 1
  System::Call 'user32::SetWindowPos(p r7, p0, i269, i540, i96, i32, i0x0004)'
  GetDlgItem $8 $HWNDPARENT 2
  System::Call 'user32::SetWindowPos(p r8, p0, i368, i540, i82, i32, i0x0004)'
!macroend

!ifndef BUILD_UNINSTALLER
Function BrandSetWindowIcon
  System::Call 'user32::LoadImageW(p0, w"$PLUGINSDIR\brand-window.ico", i${IMAGE_ICON}, i16, i16, i${LR_LOADFROMFILE}) p.r0'
  StrCpy $BrandWindowIconSmall $0
  System::Call 'user32::LoadImageW(p0, w"$PLUGINSDIR\brand-window.ico", i${IMAGE_ICON}, i32, i32, i${LR_LOADFROMFILE}) p.r0'
  StrCpy $BrandWindowIconLarge $0
  SendMessage $HWNDPARENT ${WM_SETICON} 0 $BrandWindowIconSmall
  SendMessage $HWNDPARENT ${WM_SETICON} 1 $BrandWindowIconLarge
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandSetWindowIcon
  System::Call 'user32::LoadImageW(p0, w"$PLUGINSDIR\brand-window.ico", i${IMAGE_ICON}, i16, i16, i${LR_LOADFROMFILE}) p.r0'
  StrCpy $BrandWindowIconSmall $0
  System::Call 'user32::LoadImageW(p0, w"$PLUGINSDIR\brand-window.ico", i${IMAGE_ICON}, i32, i32, i${LR_LOADFROMFILE}) p.r0'
  StrCpy $BrandWindowIconLarge $0
  SendMessage $HWNDPARENT ${WM_SETICON} 0 $BrandWindowIconSmall
  SendMessage $HWNDPARENT ${WM_SETICON} 1 $BrandWindowIconLarge
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandShapeWindow
  !insertmacro BrandShapeWindowBody
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandShapeWindow
  !insertmacro BrandShapeWindowBody
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandPrepareStarPage
  !insertmacro BrandPrepareStarPageBody
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandPrepareStarPage
  !insertmacro BrandPrepareStarPageBody
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandPositionButtons
  !insertmacro BrandPositionButtonsBody
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandPositionButtons
  !insertmacro BrandPositionButtonsBody
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandApplyInstallFrame
  IntOp $9 $BrandTwinklePhase * 8
  IntOp $9 $9 + $BrandRequestedFrame
  StrCmp $9 $BrandLastFrame brand_install_frame_done
  StrCpy $BrandLastFrame $9
  ${If} $BrandTwinklePhase == 1
    StrCpy $0 "$PLUGINSDIR\brand-star-shell-$BrandRequestedFrame-twinkle.bmp"
  ${Else}
    StrCpy $0 "$PLUGINSDIR\brand-star-shell-$BrandRequestedFrame.bmp"
  ${EndIf}
  System::Call 'user32::LoadImageW(p0, w r0, i${IMAGE_BITMAP}, i0, i0, i${LR_LOADFROMFILE}) p.r1'
  ${If} $BrandStarControl != 0
    SendMessage $BrandStarControl ${STM_SETIMAGE} ${IMAGE_BITMAP} $1
    ${If} $BrandFrameBitmap != 0
      System::Call 'gdi32::DeleteObject(p $BrandFrameBitmap)'
    ${EndIf}
    StrCpy $BrandFrameBitmap $1
  ${Else}
    System::Call 'gdi32::DeleteObject(p r1)'
  ${EndIf}
  brand_install_frame_done:
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandApplyUninstallFrame
  IntOp $9 $BrandTwinklePhase * 8
  IntOp $9 $9 + $BrandRequestedFrame
  StrCmp $9 $BrandLastFrame brand_uninstall_frame_done
  StrCpy $BrandLastFrame $9
  ${If} $BrandTwinklePhase == 1
    StrCpy $0 "$PLUGINSDIR\brand-star-shell-$BrandRequestedFrame-twinkle.bmp"
  ${Else}
    StrCpy $0 "$PLUGINSDIR\brand-star-shell-$BrandRequestedFrame.bmp"
  ${EndIf}
  System::Call 'user32::LoadImageW(p0, w r0, i${IMAGE_BITMAP}, i0, i0, i${LR_LOADFROMFILE}) p.r1'
  ${If} $BrandStarControl != 0
    SendMessage $BrandStarControl ${STM_SETIMAGE} ${IMAGE_BITMAP} $1
    ${If} $BrandFrameBitmap != 0
      System::Call 'gdi32::DeleteObject(p $BrandFrameBitmap)'
    ${EndIf}
    StrCpy $BrandFrameBitmap $1
  ${Else}
    System::Call 'gdi32::DeleteObject(p r1)'
  ${EndIf}
  brand_uninstall_frame_done:
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandWelcomeShow
  Call BrandPrepareStarPage
  StrCpy $BrandTwinklePhase 0
  StrCpy $BrandRequestedFrame 0
  Call BrandApplyInstallFrame
  Call BrandPositionButtons
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1200
  ShowWindow $1 ${SW_HIDE}
  GetDlgItem $1 $0 1201
  SendMessage $1 ${WM_SETTEXT} 0 "STR:枕星AI助手"
  SetCtlColors $1 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r1, p0, i185, i348, i250, i44, i0x0004)'
  GetDlgItem $2 $0 1202
  SendMessage $2 ${WM_SETTEXT} 0 "STR:让一颗灰色星芒，随安装进度逐渐点亮。"
  SetCtlColors $2 AEB9C4 transparent
  System::Call 'user32::SetWindowPos(p r2, p0, i160, i396, i300, i56, i0x0004)'
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandDirectoryShow
  Call BrandPrepareStarPage
  Call BrandPositionButtons
  StrCpy $BrandTwinklePhase 0
  Call BrandApplyDirectoryLayout
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandProgressShow
  Call BrandPrepareStarPage
  Call BrandPositionButtons
  StrCpy $BrandTwinklePhase 0
  StrCpy $BrandRequestedFrame 0
  Call BrandApplyInstallFrame
  Call BrandApplyProgressLayout
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandFinishShow
  Call BrandPrepareStarPage
  Call BrandPositionButtons
  StrCpy $BrandTwinklePhase 1
  StrCpy $BrandRequestedFrame 7
  Call BrandApplyInstallFrame
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1200
  ShowWindow $1 ${SW_HIDE}
  GetDlgItem $1 $0 1201
  SetCtlColors $1 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r1, p0, i190, i348, i240, i44, i0x0004)'
  GetDlgItem $2 $0 1202
  SetCtlColors $2 AEB9C4 transparent
  System::Call 'user32::SetWindowPos(p r2, p0, i175, i396, i270, i46, i0x0004)'
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandWelcomeShow
  Call un.BrandPrepareStarPage
  Call un.BrandPositionButtons
  StrCpy $BrandTwinklePhase 1
  StrCpy $BrandRequestedFrame 7
  Call un.BrandApplyUninstallFrame
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1200
  ShowWindow $1 ${SW_HIDE}
  GetDlgItem $1 $0 1201
  SendMessage $1 ${WM_SETTEXT} 0 "STR:枕星AI助手"
  SetCtlColors $1 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r1, p0, i185, i348, i250, i44, i0x0004)'
  GetDlgItem $2 $0 1202
  SendMessage $2 ${WM_SETTEXT} 0 "STR:星光将随卸载进度慢慢归于沉静。"
  SetCtlColors $2 AEB9C4 transparent
  System::Call 'user32::SetWindowPos(p r2, p0, i160, i396, i300, i56, i0x0004)'
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandProgressShow
  Call un.BrandPrepareStarPage
  Call un.BrandPositionButtons
  StrCpy $BrandTwinklePhase 0
  StrCpy $BrandRequestedFrame 7
  Call un.BrandApplyUninstallFrame
  Call un.BrandApplyProgressLayout
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandFinishShow
  Call un.BrandPrepareStarPage
  Call un.BrandPositionButtons
  StrCpy $BrandTwinklePhase 0
  StrCpy $BrandRequestedFrame 0
  Call un.BrandApplyUninstallFrame
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1200
  ShowWindow $1 ${SW_HIDE}
  GetDlgItem $1 $0 1201
  SetCtlColors $1 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r1, p0, i175, i348, i270, i44, i0x0004)'
  GetDlgItem $2 $0 1202
  SetCtlColors $2 AEB9C4 transparent
  System::Call 'user32::SetWindowPos(p r2, p0, i175, i396, i270, i46, i0x0004)'
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandApplyProgressLayout
  StrCpy $BrandProgressLayoutApplied 1
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $7 $0 1006
  SetCtlColors $7 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r7, p0, i160, i372, i300, i28, i0x0004)'
  GetDlgItem $8 $0 1004
  System::Call 'user32::SetWindowPos(p r8, p0, i160, i410, i300, i18, i0x0004)'
  GetDlgItem $9 $0 1016
  ShowWindow $9 ${SW_HIDE}
  GetDlgItem $6 $0 1027
  ShowWindow $6 ${SW_HIDE}
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandApplyProgressLayout
  StrCpy $BrandProgressLayoutApplied 1
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $7 $0 1006
  SetCtlColors $7 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r7, p0, i160, i372, i300, i28, i0x0004)'
  GetDlgItem $8 $0 1004
  System::Call 'user32::SetWindowPos(p r8, p0, i160, i410, i300, i18, i0x0004)'
  GetDlgItem $9 $0 1016
  ShowWindow $9 ${SW_HIDE}
  GetDlgItem $6 $0 1027
  ShowWindow $6 ${SW_HIDE}
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandApplyDirectoryLayout
  StrCpy $BrandDirectoryLayoutApplied 1
  StrCpy $BrandRequestedFrame 0
  Call BrandApplyInstallFrame
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $7 $0 1006
  SendMessage $7 ${WM_SETTEXT} 0 "STR:选择安装位置 · 安装给这台电脑上的所有用户"
  SetCtlColors $7 E2E8EE transparent
  System::Call 'user32::SetWindowPos(p r7, p0, i145, i360, i330, i28, i0x0004)'
  GetDlgItem $8 $0 1019
  System::Call 'user32::SetWindowPos(p r8, p0, i145, i400, i250, i25, i0x0004)'
  GetDlgItem $9 $0 1001
  System::Call 'user32::SetWindowPos(p r9, p0, i402, i398, i73, i29, i0x0004)'
  GetDlgItem $6 $0 1023
  SetCtlColors $6 AEB9C4 transparent
  System::Call 'user32::SetWindowPos(p r6, p0, i145, i440, i160, i20, i0x0004)'
  GetDlgItem $5 $0 1024
  SetCtlColors $5 AEB9C4 transparent
  System::Call 'user32::SetWindowPos(p r5, p0, i315, i440, i160, i20, i0x0004)'
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandInstallTick
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1019
  ${If} $1 != 0
    StrCpy $BrandTwinklePhase 0
    StrCpy $BrandTwinkleTick 0
    Return
  ${EndIf}
  GetDlgItem $1 $0 1004
  ${If} $1 == 0
    Return
  ${EndIf}
  SendMessage $1 ${PBM_GETPOS} 0 0 $2
  SendMessage $1 ${PBM_GETRANGE} 0 0 $3
  ${If} $3 <= 0
    StrCpy $3 100
  ${EndIf}
  IntOp $4 $2 * 7
  IntOp $4 $4 / $3
  ${If} $4 < 0
    StrCpy $4 0
  ${ElseIf} $4 > 7
    StrCpy $4 7
  ${EndIf}
  IntOp $BrandTwinkleTick $BrandTwinkleTick + 1
  ${If} $BrandTwinkleTick >= 5
    StrCpy $BrandTwinkleTick 0
    IntOp $BrandTwinklePhase 1 - $BrandTwinklePhase
  ${EndIf}
  StrCpy $BrandRequestedFrame $4
  SendMessage $1 ${PBM_SETBARCOLOR} 0 0x00EED322
  Call BrandApplyInstallFrame
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandUninstallTick
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1004
  ${If} $1 == 0
    Return
  ${EndIf}
  SendMessage $1 ${PBM_GETPOS} 0 0 $2
  SendMessage $1 ${PBM_GETRANGE} 0 0 $3
  ${If} $3 <= 0
    StrCpy $3 100
  ${EndIf}
  IntOp $4 $2 * 7
  IntOp $4 $4 / $3
  IntOp $5 7 - $4
  ${If} $5 < 0
    StrCpy $5 0
  ${ElseIf} $5 > 7
    StrCpy $5 7
  ${EndIf}
  IntOp $BrandTwinkleTick $BrandTwinkleTick + 1
  ${If} $BrandTwinkleTick >= 5
    StrCpy $BrandTwinkleTick 0
    IntOp $BrandTwinklePhase 1 - $BrandTwinklePhase
  ${EndIf}
  StrCpy $BrandRequestedFrame $5
  SendMessage $1 ${PBM_SETBARCOLOR} 0 0x00EED322
  Call un.BrandApplyUninstallFrame
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function BrandInstallerGuiInit
  StrCpy $BrandFrameBitmap 0
  StrCpy $BrandStarControl 0
  StrCpy $BrandLastFrame -1
  StrCpy $BrandProgressLayoutApplied 0
  StrCpy $BrandDirectoryLayoutApplied 0
  StrCpy $BrandTwinklePhase 0
  StrCpy $BrandTwinkleTick 0
  Call BrandSetWindowIcon
  Call BrandShapeWindow
  ${NSD_CreateTimer} BrandInstallTick 90
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.BrandUninstallerGuiInit
  StrCpy $BrandFrameBitmap 0
  StrCpy $BrandStarControl 0
  StrCpy $BrandLastFrame -1
  StrCpy $BrandProgressLayoutApplied 0
  StrCpy $BrandDirectoryLayoutApplied 0
  StrCpy $BrandTwinklePhase 1
  StrCpy $BrandTwinkleTick 0
  Call un.BrandSetWindowIcon
  Call un.BrandShapeWindow
  ${NSD_CreateTimer} un.BrandUninstallTick 90
FunctionEnd
!endif
