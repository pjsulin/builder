import "./style.css";
import { App } from "./app";
import { loadKernel } from "./kernel/model";
import { AutosaveStore, type Version } from "./store/autosave";
import { errorMessage } from "./tools/tool";

loadKernel()
  .then(async () => {
    const store = new AutosaveStore();
    // Read before `new App()`: its sample load calls attach(..., false), which clears the dirty flag.
    let candidate: Version | undefined;
    let storeError: unknown;
    try {
      candidate = (await store.dirty()) ? await store.latest() : undefined;
    } catch (e) {
      storeError = e;
    }
    const app = new App(store);
    (window as unknown as { builder: App }).builder = app;
    if (storeError !== undefined) app.flash(`Autosave unavailable: ${errorMessage(storeError)}`);
    else await app.offerRestore(candidate);
  })
  .catch((e) => {
    document.getElementById("hint")!.textContent = `The geometry kernel failed to load: ${e}`;
    console.error(e);
  });
