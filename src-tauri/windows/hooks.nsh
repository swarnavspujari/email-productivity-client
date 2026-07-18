; NSIS install hooks (wired via bundle.windows.nsis.installerHooks).
;
; Updater-driven installs run with /UPDATE, and Tauri's template skips ALL
; shortcut creation in update mode. Across the Fission→Snail rename the first
; update lands in a brand-new "Snail Mail" install dir with a new uninstall
; key, so nothing ever creates a "Snail Mail" Start-menu entry — the old
; "Fission Mail" shortcut would remain the only launcher. Create the shortcut
; when it is missing; on fresh interactive installs it already exists and this
; is a no-op. The uninstaller removes it like any template-created shortcut
; (same name, same target).
!macro NSIS_HOOK_POSTINSTALL
  ${IfNot} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}
!macroend
