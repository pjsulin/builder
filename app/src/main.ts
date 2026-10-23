import "./style.css";
import { App } from "./app";
import { loadKernel } from "./kernel/model";

loadKernel()
  .then(() => {
    (window as unknown as { builder: App }).builder = new App();
  })
  .catch((e) => {
    document.getElementById("hint")!.textContent = `The geometry kernel failed to load: ${e}`;
    console.error(e);
  });
