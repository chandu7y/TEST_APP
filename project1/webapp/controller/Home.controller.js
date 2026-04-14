sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, MessageBox, MessageToast) => {
    "use strict";

    return Controller.extend("msg.ri.project1.controller.Home", {
        onInit() {
            this._oFileInput = document.createElement("input");
            this._oFileInput.type = "file";
            this._oFileInput.style.display = "none";
            this._oFileInput.accept = ".pdf,.doc,.docx";
            this._oFileInput.addEventListener("change", this._onFileSelected.bind(this));
            document.body.appendChild(this._oFileInput);

            this._oExtractedJSON = null;
        },

        onUploadDocument: function () {
            this._oFileInput.click();
        },

        _onFileSelected: async function (oEvent) {
            const oFile = oEvent.target.files[0];
            if (!oFile) return;

            const fileName = oFile.name.toLowerCase();
            const isValid =
                fileName.endsWith(".pdf") ||
                fileName.endsWith(".doc") ||
                fileName.endsWith(".docx");
            if (!isValid) {
                MessageBox.warning("Only PDF or Word documents allowed.");
                this._oFileInput.value = "";
                this._oSelectedFile = null;
                return;
            }

            const oTextArea = this.byId("fileTextArea");
            oTextArea.setValue("Processing file...");
            oTextArea.setEditable(true);
            oTextArea.addStyleClass("largeTextAreaText");

            this._oSelectedFile = oFile;

            // Extract content
            let extractedText = "";

            try {
                if (fileName.endsWith(".pdf")) {
                    extractedText = await this._readPDF(oFile);
                } else {
                    extractedText = await this._readWord(oFile);
                }

                this._fileContent = extractedText;

                await this._processFileWithAI(extractedText);

            } catch (err) {
                console.error(err);
                MessageBox.error("Error reading file");
            }

            this._oFileInput.value = "";
        },

        _readPDF: async function (file) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;

            let text = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();

                const strings = content.items.map(item => item.str);
                text += strings.join(" ") + "\n";
            }

            return text;
        },

        _loadMammoth: function () {
            return new Promise((resolve, reject) => {
                if (window.mammoth) {
                    resolve();
                    return;
                }

                const script = document.createElement("script");
                script.src = "https://unpkg.com/mammoth/mammoth.browser.min.js";

                script.onload = () => resolve();
                script.onerror = () => reject("Failed to load mammoth");

                document.head.appendChild(script);
            });
        },

        _readWord: async function (file) {
            await this._loadMammoth();

            const arrayBuffer = await file.arrayBuffer();
            const result = await window.mammoth.extractRawText({ arrayBuffer });

            return result.value;
        },

        _processFileWithAI: async function (sFileContent) {
            const oTextArea = this.getView().byId("fileTextArea");
            oTextArea.setValue("Processing file, please wait...");

            // STRICT prompt — only extract what is literally present in the file.
            // No inventing fields, no null placeholders, no hallucination.
            const sPrompt =
                                `Treaty Analysis and JSON Generation Prompt
                You are a reinsurance treaty specialist tasked with analyzing treaty documents and generating structured JSON responses. Follow these guidelines strictly for consistent output.
                
                CRITICAL: Response Structure Requirements
                    JSON Section: Provide ONLY the JSON data inside json code block
                    Summary Section: Provide summary as plain text OUTSIDE the JSON code block
                    Never include: Summary text, explanations, or any non-JSON content inside the json block
                    Format: Replace all null values with empty strings ("")
                    JSON Syntax: Must be valid JSON - no syntax errors, no trailing commas, proper quotes
                    Complete Response: Never provide incomplete or truncated JSON responses
                
                CRITICAL FORMATTING REQUIREMENTS (Must Follow Exactly)
                    1. Code Block Format (MANDATORY)
                    CORRECT FORMAT:
                    \`\`\`json
                    {
                        "field": "value"
                    }
                    \`\`\`
                
                    WRONG FORMATS (Never Use):
                    \`\`\`\`json\` (only one backtick)
                    {json (wrong order)
                
                    2. Response Completeness
                    Always provide complete JSON - never cut off mid-response
                    Include all required fields from the template
                    End with proper closing braces }
                    No truncated responses - complete the entire JSON structure
                
                    3. Field Value Restrictions
                    TTY_CATEGORY - "ASSUMED"/"CEDED"
                    TTY_TYPE - Use EXACTLY one of: "OBLIGATORY PROPORTIONAL" or "EXCESS OF LOSS"
                    ACCOUNTING_MODE - Use ONLY "Underwriting Year" or "Occurrence Year"
                    TTY_ACCOUNTING_FREQUENCY - Use ONLY "Annually", "Quarterly", or "HalfYearly"
                
                Treaty Classification Rules (Use EXACT Values Only)
                    TTY_CATEGORY: Use ONLY "CEDED" or "ASSUMED"
                    TTY_TYPE: Use ONLY "OBLIGATORY PROPORTIONAL" or "NON-PROPORTIONAL"
                    ACCOUNTING_MODE: Use ONLY "Underwriting Year" or "Occurrence Year"
                    TTY_ACCOUNTING_FREQUENCY: Use ONLY "Annually", "Quarterly", or "HalfYearly"
                
                Section Creation Hierarchy (Strictly Follow)
                STEP 2: APPLY SECTION CREATION RULES whenever explicit sections/layers were not mentioned.
                
                RULE 1: Geographic Priority (PRIMARY RULE)
                    Different geographic areas MUST create separate sections.
                
                RULE 2: COB Grouping
                    Within the same geographic area, group similar COBs together.
                    COB Families: Liability, Property, Financial/Crime, Personal Lines, Marine, Motor, Engineering.
                
                RULE 3: Area + COB Combination
                    One Geographic Area + One COB Family = One Section.
                
                RULE 4: No Duplication (STRICT)
                    Each specific COB can appear in EXACTLY ONE section only.
                
                RULE 5: Worldwide Coverage Special Treatment
                    Treaties with "Worldwide" or "Global" coverage need separate section(s).
                    Do NOT mix worldwide with regional coverage.
                
                RULE 6: Excess of Loss Layer Rule
                    For XoL treaties ONLY: Number of sections = Number of layers.
                
                RULE 7: Minimalist Creation
                    Create ONLY sections that are explicitly necessary.
                    Do NOT create speculative sections.
                
                RULE 8: LOB (line of business)
                    Create ONLY the line of business mentioned; if not mentioned leave empty array.
                
                Final Instructions:
                    One JSON Response Only: Never provide multiple versions
                    Preserve Original Data: Maintain spellings, comma formatting from source
                    Complete All Fields: Use empty strings for missing data, never null
                    Follow Hierarchy: Stick to section creation rules strictly
                    Separate JSON and Summary: JSON in code block, summary outside
                    Treaty Type Detection: Any mention of "Excess of Loss" = XOL treaty
                    XOL Critical Rule: When MAX_LIABILITY and MAX_RETENTION are empty, focus on accurate LIMITS array population only
                    Sliding Scale Commission: Always map under RDC_DETAILS with complete scale extraction and reverse mapping order
                    Maximum Liabilities: Do not consider Annual aggregate values in MAX_LIABILITY.
                    Sliding Scale Summary: MANDATORY inclusion of dedicated Sliding Scale Commission Details section when present.
                    Make sure that always sections consideration should be done and validate the above guidelines. Strictly to be followed.
                    Mandatory to be followed: Make sure GNPI or EPI or ESP should always be displayed along with section details.
                    If any surplus sections/layers mentioned along with Quota then consider Quota as one section and Surplus as one section.
                    If number of lines and maximum limit were mentioned under section details along with Quota share percentage, consider these as two different sections: one as Surplus and other as Quota.
                `.trim()+
                `File content:\n${sFileContent}`;

            try {
                const oResponse = await fetch(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-goog-api-key": "AIzaSyABCWXYD5nvQuXbelKk1S00UoxXLL7b_Bo"
                        },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: sPrompt }] }]
                        })
                    }
                );

                const oData = await oResponse.json();

                if (!oData.candidates || oData.candidates.length === 0) {
                    oTextArea.setValue("AI returned no response. Please try again.");
                    return;
                }

                let sRaw = oData.candidates[0].content.parts[0].text.trim();

                // Strip any markdown fences Gemini might still add
                sRaw = sRaw
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/```\s*$/i, "")
                    .trim();

                try {
                    const oParsed = JSON.parse(sRaw);
                    this._oExtractedJSON = oParsed;
                    oTextArea.setValue(JSON.stringify(oParsed, null, 2));
                    MessageToast.show("Data extracted. Click Send to post to backend.");
                } catch (parseErr) {
                    oTextArea.setValue("Could not parse AI response as JSON:\n\n" + sRaw);
                    MessageBox.warning("The AI response was not valid JSON. Check the text area.");
                }

            } catch (error) {
                console.error("Gemini API error:", error);
                oTextArea.setValue("Error calling AI: " + error.message);
            }
        }
    });
});