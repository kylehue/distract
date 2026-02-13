import { BrowserWindow, dialog, ipcMain, app } from "electron";

let showCloseWarningDialog = false;
let allowCloseOnce = false;
let isQuitting = false;

export async function setupCloseDialog(win: BrowserWindow) {
   win.on("close", async (e) => {
      // If we are quitting or already allowed, don't block.
      if (isQuitting || allowCloseOnce) return;

      // If dialog disabled, allow close
      if (!showCloseWarningDialog) return;

      e.preventDefault();

      const { response } = await dialog.showMessageBox(win, {
         type: "warning",
         title: "Exit?",
         message: "Are you sure you want to close the app?",
         detail:
            "An active room session is in progress. Closing the app may negatively impact your session integrity and recorded statistics.",
         buttons: ["Cancel", "Close"],
         defaultId: 0,
         cancelId: 0,
         noLink: true,
      });

      if (response === 1) {
         allowCloseOnce = true;
         win.close();
      }
   });

   // Reset allowCloseOnce if the window is recreated later
   win.on("closed", () => {
      allowCloseOnce = false;
   });

   app.on("before-quit", () => {
      isQuitting = true;
      // If app is quitting, don't block window closes
      allowCloseOnce = true;
   });

   ipcMain.handle("set-show-close-warning-dialog", (_e, value: boolean) => {
      showCloseWarningDialog = !!value;
      return showCloseWarningDialog;
   });

   ipcMain.handle("get-show-close-warning-dialog", () => {
      return showCloseWarningDialog;
   });
}
