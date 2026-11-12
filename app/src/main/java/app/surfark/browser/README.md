# app.surfark.browser

Surfark Browser's own Android code. It sits on top of Sideraven's package (`pt.dweep.sideraven`),
which in turn sits on Fenix. Upstream files only call in here through lines marked
`SURFARK-HOOK`; `automation/surfark/list-hooks.sh` lists them. What each feature is and why is
recorded in `docs/surfark/README.md`. Unit tests live in `app/src/testSideraven/java/app/surfark/`.
