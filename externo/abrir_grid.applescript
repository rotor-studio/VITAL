on run
  set theUrl to "http://localhost:8000/grid"
  -- Abrir Chrome en ventana nueva
  tell application "Google Chrome"
    activate
    if not (exists window 1) then
      make new window
    end if
    set URL of active tab of window 1 to theUrl
  end tell
  -- Esperar a que aparezca la ventana
  tell application "Google Chrome"
    repeat until (count of windows) > 0
      delay 0.2
    end repeat
    activate
  end tell
  -- Mover y poner fullscreen
  tell application "System Events"
    tell process "Google Chrome"
      set frontmost to true
      set position of window 1 to {1920, 0}
      set size of window 1 to {1920, 1080}
      key code 3 using {command down, control down}
    end tell
  end tell
end run
