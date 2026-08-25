# v80 macOS Window Resize Desktop Plugin Physical — PASS

Run 4 after the macOS loginwindow block was cleared.

```text
runtime-ready=PASS
fixture-open=PASS
application-ready=PASS
target-window={"id":"pid:64552:window:0","title":"rumiai-v80-desktop-resize.txt","process":"TextEdit","pid":64552,"focused":false,"pinned":true}
fixture-prepared=PASS
desktop-resize=PASS
desktop-resize-state=RESIZED
desktop-resize-verified=true
desktop-resize-verification=native-ax-window-size
desktop-resize-bounds={"x":250,"y":190,"width":780,"height":535}
desktop-resize-position-preserved=PASS
independent-resize-state=PASS
independent-resize-bounds={"x":250,"y":190,"width":780,"height":535}
physical-window-resize-desktop=PASS
fixture-restored-state=PASS
fixture-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

The previously recorded BLOCKED runs were caused by loginwindow being foreground. With the graphical session active, the unchanged production resize path physically passed.
