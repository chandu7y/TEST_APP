sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("msg.ri.project1.controller.Home", {
        onInit() {
            this._oFileInput = document.createElement("input");
            this._oFileInput.type = "file";
            this._oFileInput.style.display = "none";
            this._oFileInput.addEventListener("change", this._onFileSelected.bind(this));
            document.body.appendChild(this._oFileInput);
        },

        onUploadDocument() {
            this._oFileInput.click();
        },

        _onFileSelected(oEvent) {
            const oFile = oEvent.target.files[0];
            if (!oFile) return;

            

            this._oSelectedFile = oFile;
            this._oFileInput.value = "";
        }
    });
});