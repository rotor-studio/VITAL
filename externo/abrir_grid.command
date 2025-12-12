#!/bin/bash
url="http://localhost:8000/grid"
# Abrir Chrome en ventana nueva apuntando a la URL
open -na "Google Chrome" --args --new-window "$url"
# Dar tiempo a que la ventana aparezca y moverla a la pantalla extendida
osascript <<'APPLESCRIPT'
-- Esperar a que Chrome esté corriendo y tenga ventana
repeat until application "Google Chrome" is running
  delay 0.2
end repeat
tell application "Google Chrome"
  repeat until (count of windows) > 0
    delay 0.2
  end repeat
  set theWindow to window 1
  activate
end tell

tell application "System Events"
  tell process "Google Chrome"
    set frontmost to true
    set position of window 1 to {1920, 0}
    set size of window 1 to {1920, 1080}
    key code 3 using {command down, control down} -- poner en pantalla completa (⌃⌘F)
  end tell
end tell
APPLESCRIPT
