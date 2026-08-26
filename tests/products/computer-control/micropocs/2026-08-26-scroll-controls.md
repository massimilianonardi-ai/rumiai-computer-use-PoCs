# micro-PoC — ui.scroll / ui.scrollIntoView

Status: **NOT_RUN_PHYSICALLY**

Product commit: `6ef8634fb3db6098438f33c0bf906549945f1348`.

`ui.scroll` is successful only when PageUp/PageDown delivery is followed by a
fresh Accessibility snapshot with an observed change. Delivery without that
postcondition is `SCROLL_UNVERIFIED`.

`ui.scrollIntoView` is successful only when a fresh description observes
`visible === true`. A target that is already visible is an idempotent success.

The physical harness opens a temporary local Safari fixture with a long page,
an initially visible semantic scroll anchor and a uniquely named target below
the initial viewport. It checks both APIs and their observed postconditions.

Complete physical marker: `physical-native-control-scroll=PASS`.

