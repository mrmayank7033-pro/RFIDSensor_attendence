// RFID Sync - Attendance Tracker Core Logic

// Default Seed Data matching Arduino's registered student list
const DEFAULT_STUDENTS = [
    { cardUID: "3fa6d0e5", rollNumber: "1DS25IS091", name: "Mayank Kumar", lastTimeIn: "", isInside: false },
    { cardUID: "a156dd66", rollNumber: "1DS25IS096", name: "Salman", lastTimeIn: "", isInside: false },
    { cardUID: "5f93979", rollNumber: "HST-03", name: "Vaayu", lastTimeIn: "", isInside: false }
];

class RFIDAttendanceApp {
    constructor() {
        // Load data from local storage or use defaults
        this.students = JSON.parse(localStorage.getItem("rfid_students")) || [...DEFAULT_STUDENTS];
        this.logs = JSON.parse(localStorage.getItem("rfid_logs")) || [];
        this.serialCounter = parseInt(localStorage.getItem("rfid_serial_counter")) || 1;
        
        // Serial Connection State
        this.serialPort = null;
        this.serialReader = null;
        this.keepReading = false;
        this.serialBuffer = "";
        
        // State for Capture UID mode (during registration)
        this.isCapturingUid = false;

        // Configuration Settings
        this.shiftStartTime = localStorage.getItem("rfid_shift_start") || "09:00";
        this.timestampMode = localStorage.getItem("rfid_timestamp_mode") || "system"; // 'system' (live browser time) or 'arduino' (time sent by arduino)

        // Chart References
        this.charts = {
            hourly: null,
            punctuality: null,
            hours: null
        };

        // Initialize Lucide Icons
        lucide.createIcons();

        // Bind DOM Elements
        this.bindElements();
        
        // Bind Event Listeners
        this.bindEvents();

        // Start Live Clock
        this.startClock();

        // Initial Render
        this.renderAll();
        
        // Setup Charts
        this.initCharts();
    }

    bindElements() {
        // Navigation & Layout
        this.tabButtons = document.querySelectorAll(".nav-item");
        this.tabPanes = document.querySelectorAll(".tab-pane");
        this.pageTitle = document.getElementById("page-title");
        this.liveClockEl = document.getElementById("live-clock");
        
        // Connection Panel
        this.connStatusEl = document.getElementById("conn-status");
        this.btnConnect = document.getElementById("btn-connect");
        
        // Stats
        this.statActiveCount = document.getElementById("stat-active-count");
        this.statActiveSub = document.getElementById("stat-active-sub");
        this.statLogCount = document.getElementById("stat-log-count");
        this.statLogSub = document.getElementById("stat-log-sub");
        this.statPunctRate = document.getElementById("stat-punct-rate");
        this.statPunctSub = document.getElementById("stat-punct-sub");

        // Feed & Inside List
        this.feedList = document.getElementById("feed-list");
        this.insideList = document.getElementById("inside-list");
        this.insideBadgeCount = document.getElementById("inside-badge-count");
        this.btnClearFeed = document.getElementById("btn-clear-feed");

        // Hardware Simulator Panel
        this.simStudentSelect = document.getElementById("sim-student-select");
        this.customUidContainer = document.getElementById("custom-uid-container");
        this.simCustomUidInput = document.getElementById("sim-custom-uid");
        this.btnToggleCustomUid = document.getElementById("btn-toggle-custom-uid");
        this.btnSimScan = document.getElementById("btn-sim-scan");

        // Student Directory
        this.directorySearch = document.getElementById("directory-search");
        this.directoryList = document.getElementById("directory-list");
        this.btnAddStudent = document.getElementById("btn-add-student");
        this.btnExportCsv = document.getElementById("btn-export-csv");
        this.btnImportCsvTrigger = document.getElementById("btn-import-csv-trigger");
        this.importCsvFile = document.getElementById("import-csv-file");

        // Serial Settings Tab
        this.serialBaudSelect = document.getElementById("serial-baud");
        this.serialTimestampSelect = document.getElementById("serial-timestamp-mode");
        this.configShiftStart = document.getElementById("config-shift-start");
        this.btnSerialConnectMonitor = document.getElementById("btn-serial-connect-monitor");
        this.serialLog = document.getElementById("serial-log");
        this.serialBufferBadge = document.getElementById("serial-buffer-badge");
        this.btnCopyConsole = document.getElementById("btn-copy-console");
        this.btnClearConsole = document.getElementById("btn-clear-console");

        // Modals
        this.modalStudent = document.getElementById("modal-student");
        this.formStudent = document.getElementById("form-student");
        this.studentEditIndex = document.getElementById("student-edit-index");
        this.studentNameInput = document.getElementById("student-name");
        this.studentRollInput = document.getElementById("student-roll");
        this.studentUidInput = document.getElementById("student-uid");
        this.btnCaptureUid = document.getElementById("btn-capture-uid");
        this.captureStatusText = document.getElementById("capture-status");
        this.btnSaveStudent = document.getElementById("btn-save-student");
        this.btnCancelStudent = document.getElementById("btn-cancel-student");
        this.btnCloseStudentModal = document.getElementById("btn-close-student-modal");

        this.modalDossier = document.getElementById("modal-dossier");
        this.dossierName = document.getElementById("dossier-name");
        this.dossierStatusBadge = document.getElementById("dossier-status-badge");
        this.dossierInfoName = document.getElementById("dossier-info-name");
        this.dossierInfoRoll = document.getElementById("dossier-info-roll");
        this.dossierInfoUid = document.getElementById("dossier-info-uid");
        this.dossierStatHours = document.getElementById("dossier-stat-hours");
        this.dossierStatScans = document.getElementById("dossier-stat-scans");
        this.dossierStatPunct = document.getElementById("dossier-stat-punct");
        this.dossierTimeline = document.getElementById("dossier-timeline");
        this.btnCloseDossierModal = document.getElementById("btn-close-dossier-modal");

        // Global Settings Buttons
        this.themeToggleBtn = document.getElementById("theme-toggle");
        this.systemResetBtn = document.getElementById("system-reset");
    }

    bindEvents() {
        // Theme Toggle
        const savedTheme = localStorage.getItem("rfid_theme") || "dark";
        if (savedTheme === "light") {
            document.body.classList.remove("dark-theme");
            document.body.classList.add("light-theme");
        }
        this.themeToggleBtn.addEventListener("click", () => this.toggleTheme());

        // Global Reset Data
        this.systemResetBtn.addEventListener("click", () => this.resetAppPrompt());

        // Sidebar Navigation Tabs
        this.tabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");
                this.switchTab(targetTab);
            });
        });

        // Connection Buttons
        this.btnConnect.addEventListener("click", () => this.toggleSerialConnection());
        this.btnSerialConnectMonitor.addEventListener("click", () => this.toggleSerialConnection());

        // Feed buttons
        this.btnClearFeed.addEventListener("click", () => {
            this.logs = [];
            this.saveLogs();
            this.renderAll();
            this.updateCharts();
            this.showToast("Activity feed cleared", "info");
        });

        // Simulator Events
        this.btnToggleCustomUid.addEventListener("click", () => {
            if (this.customUidContainer.style.display === "none") {
                this.customUidContainer.style.display = "block";
                this.simStudentSelect.disabled = true;
                this.btnToggleCustomUid.classList.add("btn-primary");
                this.btnToggleCustomUid.classList.remove("btn-secondary");
            } else {
                this.customUidContainer.style.display = "none";
                this.simStudentSelect.disabled = false;
                this.btnToggleCustomUid.classList.remove("btn-primary");
                this.btnToggleCustomUid.classList.add("btn-secondary");
            }
        });
        
        this.btnSimScan.addEventListener("click", () => this.handleSimulatedScan());

        // Student Directory Events
        this.directorySearch.addEventListener("input", () => this.renderDirectoryList());
        this.btnAddStudent.addEventListener("click", () => this.openAddStudentModal());
        this.btnCancelStudent.addEventListener("click", () => this.closeStudentModal());
        this.btnCloseStudentModal.addEventListener("click", () => this.closeStudentModal());
        
        this.formStudent.addEventListener("submit", (e) => {
            e.preventDefault();
            this.saveStudent();
        });

        // Capture UID Button
        this.btnCaptureUid.addEventListener("click", () => this.toggleUidCaptureMode());

        // Dossier Close
        this.btnCloseDossierModal.addEventListener("click", () => {
            this.modalDossier.classList.remove("active");
        });

        // CSV Import/Export
        this.btnExportCsv.addEventListener("click", () => this.exportLogsToCsv());
        this.btnImportCsvTrigger.addEventListener("click", () => this.importCsvFile.click());
        this.importCsvFile.addEventListener("change", (e) => this.handleImportFile(e));

        // Settings updates
        this.configShiftStart.addEventListener("change", (e) => {
            this.shiftStartTime = e.target.value;
            localStorage.setItem("rfid_shift_start", this.shiftStartTime);
            this.statPunctSub.textContent = `Shift: ${this.formatTime12Hr(this.shiftStartTime)}`;
            this.renderStats();
            this.updateCharts();
        });
        
        this.serialTimestampSelect.addEventListener("change", (e) => {
            this.timestampMode = e.target.value;
            localStorage.setItem("rfid_timestamp_mode", this.timestampMode);
            this.showToast(`Timestamp mode set to: ${this.timestampMode === 'system' ? 'Live Browser System Clock' : 'Arduino Serial Clock'}`, "info");
        });

        // Console Actions
        this.btnCopyConsole.addEventListener("click", () => {
            const consoleText = Array.from(this.serialLog.children)
                .map(el => el.textContent)
                .join("\n");
            navigator.clipboard.writeText(consoleText)
                .then(() => this.showToast("Console log copied to clipboard", "success"))
                .catch(() => this.showToast("Failed to copy console log", "error"));
        });
        
        this.btnClearConsole.addEventListener("click", () => {
            this.serialLog.innerHTML = `<div class="log-line system-line">[SYSTEM] Console log cleared.</div>`;
            this.serialBufferBadge.textContent = "0 bytes read";
        });
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            this.liveClockEl.textContent = now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }) + " | " + now.toLocaleTimeString("en-US");
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    toggleTheme() {
        if (document.body.classList.contains("dark-theme")) {
            document.body.classList.remove("dark-theme");
            document.body.classList.add("light-theme");
            localStorage.setItem("rfid_theme", "light");
        } else {
            document.body.classList.remove("light-theme");
            document.body.classList.add("dark-theme");
            localStorage.setItem("rfid_theme", "dark");
        }
        // Redraw charts with new styles
        this.updateCharts();
    }

    switchTab(tabId) {
        this.tabButtons.forEach(btn => {
            if (btn.getAttribute("data-tab") === tabId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        this.tabPanes.forEach(pane => {
            if (pane.id === `tab-${tabId}`) {
                pane.classList.add("active");
            } else {
                pane.classList.remove("active");
            }
        });

        // Set Header Title
        const tabTitleMap = {
            dashboard: "Dashboard Overview",
            directory: "Student Registration Directory",
            analytics: "Attendance & Punctuality Analytics",
            serial: "Live Arduino Serial Monitor"
        };
        this.pageTitle.textContent = tabTitleMap[tabId] || "RFID Sync";
    }

    // Save states
    saveStudents() {
        localStorage.setItem("rfid_students", JSON.stringify(this.students));
    }

    saveLogs() {
        localStorage.setItem("rfid_logs", JSON.stringify(this.logs));
        localStorage.setItem("rfid_serial_counter", this.serialCounter.toString());
    }

    // Global reset
    resetAppPrompt() {
        if (confirm("Are you sure you want to RESET all data? This will clear all attendance logs, restore the default student list, and wipe local storage database records.")) {
            localStorage.clear();
            this.students = [...DEFAULT_STUDENTS];
            this.logs = [];
            this.serialCounter = 1;
            this.shiftStartTime = "09:00";
            this.timestampMode = "system";
            
            // Sync values in DOM
            this.configShiftStart.value = "09:00";
            this.serialTimestampSelect.value = "system";
            
            this.saveStudents();
            this.saveLogs();
            this.renderAll();
            this.updateCharts();
            this.showToast("Database reset to factory configurations", "info");
        }
    }

    // Main Scanning Engine
    processScanInput(cardUID, rollNumber, name, timeIn, timeOut, status) {
        // Clean card UID
        const cleanUID = cardUID.trim().toLowerCase();
        
        // Find if UID is registered
        const studentIndex = this.students.findIndex(s => s.cardUID.toLowerCase() === cleanUID);
        
        let currentTime = "";
        const now = new Date();
        
        if (this.timestampMode === "system") {
            currentTime = now.toLocaleTimeString("en-US", { hour12: false });
        } else {
            // Arduino Mode: Use time in/out parsed from line
            currentTime = (status === "STUDENT ENTERED" || status === "Unknown") ? timeIn : timeOut;
            if (currentTime === "-" || !currentTime) {
                currentTime = now.toLocaleTimeString("en-US", { hour12: false });
            }
        }

        // Output raw data line in console log
        const logLine = `[SERIAL IN] ${this.serialCounter},${cleanUID},${rollNumber},${name},${timeIn},${timeOut},${status}`;
        this.writeToConsoleLog(logLine, "serial-in-line");

        // Capture UID mode bypass
        if (this.isCapturingUid) {
            this.studentUidInput.value = cleanUID;
            this.toggleUidCaptureMode(false);
            this.showToast(`UID Captured: ${cleanUID}`, "success");
            return;
        }

        let matchedStudent = null;
        let eventStatus = "Unknown";
        let finalTimeIn = "-";
        let finalTimeOut = "-";

        if (studentIndex !== -1) {
            matchedStudent = this.students[studentIndex];
            
            // Toggle student inside status based on serial line status OR calculate dynamically
            if (status === "STUDENT ENTERED" || (status === "Unknown" && !matchedStudent.isInside)) {
                matchedStudent.isInside = true;
                matchedStudent.lastTimeIn = currentTime;
                finalTimeIn = currentTime;
                eventStatus = "STUDENT ENTERED";
                this.showToast(`${matchedStudent.name} entered the building`, "success");
            } else if (status === "STUDENT EXITED" || (status === "Unknown" && matchedStudent.isInside)) {
                matchedStudent.isInside = false;
                finalTimeIn = matchedStudent.lastTimeIn || currentTime;
                finalTimeOut = currentTime;
                eventStatus = "STUDENT EXITED";
                this.showToast(`${matchedStudent.name} exited the building`, "info");
            } else {
                // If serial output specifies status explicitly, respect it
                if (status === "STUDENT ENTERED") {
                    matchedStudent.isInside = true;
                    matchedStudent.lastTimeIn = currentTime;
                    finalTimeIn = currentTime;
                    eventStatus = "STUDENT ENTERED";
                } else {
                    matchedStudent.isInside = false;
                    finalTimeIn = timeIn;
                    finalTimeOut = timeOut;
                    eventStatus = "STUDENT EXITED";
                }
            }
        } else {
            // Unregistered/Unknown Card
            eventStatus = "Unknown Scan";
            finalTimeIn = currentTime;
            this.showToast(`Security Alert: Unknown card UID ${cleanUID} scanned!`, "error");
        }

        // Add Log Item
        const logItem = {
            id: this.serialCounter++,
            cardUID: cleanUID,
            rollNumber: matchedStudent ? matchedStudent.rollNumber : "Unknown",
            name: matchedStudent ? matchedStudent.name : "Unknown",
            timeIn: finalTimeIn,
            timeOut: finalTimeOut,
            status: eventStatus,
            timestamp: now.toISOString()
        };

        this.logs.unshift(logItem); // Add to beginning of log list

        // Save State
        this.saveStudents();
        this.saveLogs();

        // Rerender all components
        this.renderAll();
        
        // Update Chart visualizations
        this.updateCharts();
    }

    // Hardware Simulator Actions
    handleSimulatedScan() {
        const studentSelect = this.simStudentSelect;
        
        // Get Time string
        const now = new Date();
        const currentTimeString = now.toLocaleTimeString("en-US", { hour12: false });

        if (this.customUidContainer.style.display === "block") {
            // Scan custom UID
            const customUid = this.simCustomUidInput.value.trim().toLowerCase();
            if (!customUid) {
                this.showToast("Please enter a custom UID to scan", "error");
                return;
            }
            this.processScanInput(customUid, "Unknown", "Unknown", currentTimeString, "-", "Unknown");
        } else {
            // Scan registered student card
            const studentIdx = parseInt(studentSelect.value);
            if (isNaN(studentIdx) || studentIdx < 0 || studentIdx >= this.students.length) return;
            
            const student = this.students[studentIdx];
            
            // Predict exit vs entry
            if (!student.isInside) {
                this.processScanInput(student.cardUID, student.rollNumber, student.name, currentTimeString, "-", "STUDENT ENTERED");
            } else {
                this.processScanInput(student.cardUID, student.rollNumber, student.name, student.lastTimeIn, currentTimeString, "STUDENT EXITED");
            }
        }
    }

    // Web Serial API Manager
    async toggleSerialConnection() {
        if (this.serialPort) {
            // Disconnect
            this.keepReading = false;
            if (this.serialReader) {
                try {
                    await this.serialReader.cancel();
                } catch(e) {
                    console.error("Error cancelling serial reader: ", e);
                }
            }
            this.showToast("RFID hardware reader disconnected", "info");
            this.setConnectionState(false);
            return;
        }

        // Connect
        if (!("serial" in navigator)) {
            alert("The Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera served over http://localhost.");
            return;
        }

        try {
            this.serialPort = await navigator.serial.requestPort();
            const baudRate = parseInt(this.serialBaudSelect.value) || 9600;
            
            await this.serialPort.open({ baudRate });
            this.keepReading = true;
            this.setConnectionState(true);
            this.showToast("RFID reader connected successfully", "success");
            this.writeToConsoleLog(`[SYSTEM] Connected to COM serial port at ${baudRate} baud.`, "system-line");
            
            this.readSerialStream();
        } catch (error) {
            console.error("Serial connection error:", error);
            this.showToast(`Failed to open serial port: ${error.message}`, "error");
            this.writeToConsoleLog(`[ERROR] Serial Connection Failed: ${error.message}`, "error-line");
            this.setConnectionState(false);
        }
    }

    async readSerialStream() {
        while (this.serialPort.readable && this.keepReading) {
            try {
                this.serialReader = this.serialPort.readable.getReader();
                const decoder = new TextDecoder();
                
                while (true) {
                    const { value, done } = await this.serialReader.read();
                    if (done) {
                        break;
                    }
                    if (value) {
                        const chunk = decoder.decode(value);
                        this.serialBuffer += chunk;
                        this.serialBufferBadge.textContent = `${this.serialBuffer.length} bytes read`;
                        
                        // Process lines separated by newline
                        let lineEndIdx;
                        while ((lineEndIdx = this.serialBuffer.indexOf("\n")) !== -1) {
                            const line = this.serialBuffer.substring(0, lineEndIdx).trim();
                            this.serialBuffer = this.serialBuffer.substring(lineEndIdx + 1);
                            
                            if (line.length > 0) {
                                this.parseSerialLine(line);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Serial reading error:", error);
                this.writeToConsoleLog(`[ERROR] Connection interrupted: ${error.message}`, "error-line");
                this.showToast("Arduino connection lost", "error");
                this.setConnectionState(false);
                break;
            } finally {
                if (this.serialReader) {
                    this.serialReader.releaseLock();
                    this.serialReader = null;
                }
            }
        }
        
        if (this.serialPort) {
            try {
                await this.serialPort.close();
            } catch (e) {
                console.error("Error closing serial port:", e);
            }
            this.serialPort = null;
            this.setConnectionState(false);
        }
    }

    setConnectionState(isConnected) {
        const indicators = [this.connStatusEl];
        const buttons = [this.btnConnect, this.btnSerialConnectMonitor];
        
        if (isConnected) {
            indicators.forEach(ind => {
                ind.className = "status-indicator connected";
                ind.querySelector(".status-text").textContent = "Connected";
            });
            buttons.forEach(btn => {
                btn.innerHTML = `<i data-lucide="unlink"></i> <span>Disconnect</span>`;
                btn.className = "btn btn-secondary";
            });
        } else {
            indicators.forEach(ind => {
                ind.className = "status-indicator disconnected";
                ind.querySelector(".status-text").textContent = "Disconnected";
            });
            buttons.forEach(btn => {
                btn.innerHTML = `<i data-lucide="usb"></i> <span>Connect Arduino</span>`;
                btn.className = "btn btn-primary";
            });
            this.serialPort = null;
        }
        lucide.createIcons();
    }

    parseSerialLine(line) {
        // Expected format: Serial Number,RFID Card Number,Roll Number,Name,Time In,Time Out,Status
        // Example: 1,3fa6d0e5,1DS25IS091,Mayank Kumar,15:35:50,-,STUDENT ENTERED
        
        // Skip header line if present
        if (line.includes("Serial Number") || line.includes("RFID Card Number")) {
            this.writeToConsoleLog(`[SYSTEM HEADER] ${line}`, "system-line");
            return;
        }

        const parts = line.split(",");
        if (parts.length >= 7) {
            const cardUID = parts[1];
            const rollNumber = parts[2];
            const name = parts[3];
            const timeIn = parts[4];
            const timeOut = parts[5];
            const status = parts[6];

            this.processScanInput(cardUID, rollNumber, name, timeIn, timeOut, status);
        } else {
            // Raw debugging output if line format isn't complete
            this.writeToConsoleLog(`[RAW LINE] ${line}`, "serial-in-line");
            
            // Check if it looks like a hex UID (for capture UID mode)
            const possibleUID = line.replace(/[^a-zA-Z0-9]/g, "").trim().toLowerCase();
            if (this.isCapturingUid && possibleUID.length >= 6 && possibleUID.length <= 10) {
                this.studentUidInput.value = possibleUID;
                this.toggleUidCaptureMode(false);
                this.showToast(`UID Captured: ${possibleUID}`, "success");
            }
        }
    }

    writeToConsoleLog(text, className) {
        const lineEl = document.createElement("div");
        lineEl.className = `log-line ${className}`;
        lineEl.textContent = text;
        this.serialLog.appendChild(lineEl);
        
        // Auto Scroll
        this.serialLog.scrollTop = this.serialLog.scrollHeight;
    }

    // Modal Manager
    openAddStudentModal() {
        this.studentEditIndex.value = "-1";
        this.modalStudent.querySelector("#modal-student-title").textContent = "Register New Student";
        this.studentNameInput.value = "";
        this.studentRollInput.value = "";
        this.studentUidInput.value = "";
        this.modalStudent.classList.add("active");
    }

    openEditStudentModal(index) {
        const student = this.students[index];
        this.studentEditIndex.value = index.toString();
        this.modalStudent.querySelector("#modal-student-title").textContent = "Edit Registration Settings";
        this.studentNameInput.value = student.name;
        this.studentRollInput.value = student.rollNumber;
        this.studentUidInput.value = student.cardUID;
        this.modalStudent.classList.add("active");
    }

    closeStudentModal() {
        this.modalStudent.classList.remove("active");
        this.toggleUidCaptureMode(false);
    }

    toggleUidCaptureMode(forceState = null) {
        this.isCapturingUid = forceState !== null ? forceState : !this.isCapturingUid;
        
        if (this.isCapturingUid) {
            this.btnCaptureUid.classList.add("btn-primary");
            this.btnCaptureUid.classList.remove("btn-secondary");
            this.captureStatusText.textContent = "Listening for RFID scanner card UID...";
            this.captureStatusText.className = "input-help color-blue animate-pulse";
        } else {
            this.btnCaptureUid.classList.remove("btn-primary");
            this.btnCaptureUid.classList.add("btn-secondary");
            this.captureStatusText.textContent = "Click RFID scan button or swipe card to auto-capture.";
            this.captureStatusText.className = "input-help";
        }
    }

    saveStudent() {
        const index = parseInt(this.studentEditIndex.value);
        const name = this.studentNameInput.value.trim();
        const roll = this.studentRollInput.value.trim();
        const uid = this.studentUidInput.value.trim().toLowerCase();

        if (!name || !roll || !uid) {
            this.showToast("All fields are required", "error");
            return;
        }

        // Check if UID is already registered by another student
        const duplicateUidIdx = this.students.findIndex((s, idx) => s.cardUID.toLowerCase() === uid && idx !== index);
        if (duplicateUidIdx !== -1) {
            this.showToast(`Card UID ${uid} is already registered to ${this.students[duplicateUidIdx].name}`, "error");
            return;
        }

        if (index === -1) {
            // Add Student
            const newStudent = { cardUID: uid, rollNumber: roll, name: name, lastTimeIn: "", isInside: false };
            this.students.push(newStudent);
            this.showToast(`Registered student: ${name}`, "success");
        } else {
            // Edit Student
            this.students[index].name = name;
            this.students[index].rollNumber = roll;
            this.students[index].cardUID = uid;
            this.showToast(`Updated student registration: ${name}`, "success");
        }

        this.saveStudents();
        this.closeStudentModal();
        this.renderAll();
        this.updateCharts();
    }

    deleteStudent(index) {
        const student = this.students[index];
        if (confirm(`Are you sure you want to delete ${student.name} (${student.rollNumber})? This will not clear their scan history logs but they will now register as "Unknown" UIDs.`)) {
            this.students.splice(index, 1);
            this.saveStudents();
            this.renderAll();
            this.updateCharts();
            this.showToast("Student deleted", "info");
        }
    }

    // Individual Student Dossier Profile Modal
    openStudentDossier(cardUID) {
        const student = this.students.find(s => s.cardUID.toLowerCase() === cardUID.toLowerCase());
        const studentLogs = this.logs.filter(l => l.cardUID.toLowerCase() === cardUID.toLowerCase());

        // Fill dossier data
        this.dossierInfoName.textContent = student ? student.name : "Unregistered User";
        this.dossierInfoRoll.textContent = student ? student.rollNumber : "RFID Card";
        this.dossierInfoUid.textContent = cardUID;
        this.dossierName.textContent = student ? `${student.name}'s Profile` : "Dossier Profile";

        const statusBadge = this.dossierStatusBadge;
        const isInside = student ? student.isInside : false;
        
        if (isInside) {
            statusBadge.textContent = "INSIDE";
            statusBadge.className = "badge badge-emerald";
        } else {
            statusBadge.textContent = "OUTSIDE";
            statusBadge.className = "badge badge-rose";
        }

        // Calculate Dossier Stats
        // 1. Scans count
        this.dossierStatScans.textContent = studentLogs.length;

        // 2. Total time spent inside
        let totalMs = 0;
        // Group entries and exits by pairs
        // Since logs is in reverse chronological order, let's reverse it to chronological to calculate durations
        const chronLogs = [...studentLogs].reverse();
        
        let lastEntryTime = null;
        chronLogs.forEach(log => {
            if (log.status === "STUDENT ENTERED") {
                lastEntryTime = new Date(log.timestamp);
            } else if (log.status === "STUDENT EXITED" && lastEntryTime) {
                const exitTime = new Date(log.timestamp);
                totalMs += (exitTime - lastEntryTime);
                lastEntryTime = null; // reset pair
            }
        });
        
        // If student is currently inside, add time from last entry to now
        if (isInside && lastEntryTime) {
            totalMs += (new Date() - lastEntryTime);
        }

        const totalMinutes = Math.floor(totalMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        this.dossierStatHours.textContent = `${hours}h ${minutes}m`;

        // 3. Punctuality
        let totalEntries = 0;
        let onTimeEntries = 0;
        
        chronLogs.forEach(log => {
            if (log.status === "STUDENT ENTERED") {
                totalEntries++;
                const isLate = this.checkIfTimeLate(log.timeIn, this.shiftStartTime);
                if (!isLate) {
                    onTimeEntries++;
                }
            }
        });

        const punctRate = totalEntries > 0 ? Math.round((onTimeEntries / totalEntries) * 100) : null;
        this.dossierStatPunct.textContent = punctRate !== null ? `${punctRate}%` : "--%";

        // Render timeline logs
        this.dossierTimeline.innerHTML = "";
        if (studentLogs.length === 0) {
            this.dossierTimeline.innerHTML = `<div class="empty-state"><i data-lucide="calendar"></i><p>No activity logs recorded for this card.</p></div>`;
            lucide.createIcons();
        } else {
            studentLogs.forEach(log => {
                const item = document.createElement("div");
                const isEntry = log.status === "STUDENT ENTERED";
                item.className = `timeline-item ${isEntry ? "status-in" : "status-out"}`;
                
                item.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <span class="timeline-status ${isEntry ? "color-emerald" : "color-rose"}">
                            ${log.status === "STUDENT ENTERED" ? "Entered Building" : "Exited Building"}
                        </span>
                        <span class="timeline-time">${isEntry ? log.timeIn : log.timeOut}</span>
                    </div>
                `;
                this.dossierTimeline.appendChild(item);
            });
        }

        this.modalDossier.classList.add("active");
    }

    // Helper functions
    checkIfTimeLate(scanTimeStr, shiftTimeStr) {
        if (!scanTimeStr || scanTimeStr === "-") return false;
        
        const scanParts = scanTimeStr.split(":");
        const shiftParts = shiftTimeStr.split(":");
        
        if (scanParts.length < 2 || shiftParts.length < 2) return false;
        
        const scanHour = parseInt(scanParts[0]);
        const scanMin = parseInt(scanParts[1]);
        const shiftHour = parseInt(shiftParts[0]);
        const shiftMin = parseInt(shiftParts[1]);
        
        if (scanHour > shiftHour) return true;
        if (scanHour === shiftHour && scanMin > shiftMin) return true;
        return false;
    }

    formatTime12Hr(time24) {
        if (!time24) return "";
        const parts = time24.split(":");
        let hour = parseInt(parts[0]);
        const min = parts[1];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12; // hour '0' should be '12'
        return `${hour}:${min} ${ampm}`;
    }

    // Render Stats panel
    renderStats() {
        // 1. Present counts
        const insideCount = this.students.filter(s => s.isInside).length;
        this.statActiveCount.textContent = insideCount;
        this.insideBadgeCount.textContent = insideCount;
        
        if (insideCount === 1) {
            this.statActiveSub.textContent = "1 student inside";
        } else if (insideCount > 1) {
            this.statActiveSub.textContent = `${insideCount} students inside`;
        } else {
            this.statActiveSub.textContent = "No students inside";
        }

        // 2. Scans Count today
        this.statLogCount.textContent = this.logs.length;
        this.statLogSub.textContent = `${this.logs.filter(l => l.status === 'STUDENT ENTERED').length} entries, ${this.logs.filter(l => l.status === 'STUDENT EXITED').length} exits`;

        // 3. Punctuality Rate
        let totalEntries = 0;
        let onTimeEntries = 0;
        
        this.logs.forEach(log => {
            if (log.status === "STUDENT ENTERED") {
                const student = this.students.find(s => s.cardUID === log.cardUID);
                if (student) { // only count registered students
                    totalEntries++;
                    if (!this.checkIfTimeLate(log.timeIn, this.shiftStartTime)) {
                        onTimeEntries++;
                    }
                }
            }
        });

        if (totalEntries > 0) {
            const punctRate = Math.round((onTimeEntries / totalEntries) * 100);
            this.statPunctRate.textContent = `${punctRate}%`;
            this.statPunctRate.className = `stat-val ${punctRate >= 80 ? 'color-emerald' : punctRate >= 50 ? 'color-amber' : 'color-rose'}`;
            this.statPunctSub.innerHTML = `<span class="color-emerald">${onTimeEntries}</span> of ${totalEntries} arrivals on time`;
        } else {
            this.statPunctRate.textContent = "--%";
            this.statPunctRate.className = "stat-val";
            this.statPunctSub.textContent = `Shift: ${this.formatTime12Hr(this.shiftStartTime)}`;
        }
    }

    // Render Lists
    renderLiveFeed() {
        this.feedList.innerHTML = "";
        
        if (this.logs.length === 0) {
            this.feedList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>No RFID scans recorded yet. Connect your Arduino or use the simulator panel to scan a card.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        this.logs.forEach(log => {
            const row = document.createElement("div");
            const isEntry = log.status === "STUDENT ENTERED";
            const isUnknown = log.status === "Unknown Scan" || log.status === "Unknown";
            
            let statusClass = "status-unknown";
            let iconType = "shield-alert";
            let statusText = "Unregistered Card Scan";
            
            if (isEntry) {
                statusClass = "status-entered";
                iconType = "log-in";
                statusText = "Student Entered";
            } else if (log.status === "STUDENT EXITED") {
                statusClass = "status-exited";
                iconType = "log-out";
                statusText = "Student Exited";
            }

            row.className = `feed-card ${statusClass}`;
            
            const timeDisplay = isEntry ? log.timeIn : (isUnknown ? log.timeIn : log.timeOut);
            const isLate = isEntry && this.checkIfTimeLate(log.timeIn, this.shiftStartTime);

            row.innerHTML = `
                <div class="feed-card-icon ${isEntry ? 'bg-emerald-light color-emerald' : isUnknown ? 'bg-rose-light color-rose' : 'bg-amber-light color-amber'}">
                    <i data-lucide="${iconType}"></i>
                </div>
                <div class="feed-info">
                    <span class="feed-name">${log.name}</span>
                    <span class="feed-roll">${log.rollNumber} • <span class="feed-uid">${log.cardUID}</span></span>
                </div>
                <div class="feed-time-badge">
                    <span class="feed-time">${timeDisplay}</span>
                    <span class="badge ${isEntry ? (isLate ? 'badge-rose' : 'badge-emerald') : isUnknown ? 'badge-rose' : 'badge-indigo'}">
                        ${isEntry ? (isLate ? 'Late' : 'On-Time') : statusText}
                    </span>
                </div>
            `;
            
            // Allow double clicking feed card to view dossier
            row.addEventListener("dblclick", () => this.openStudentDossier(log.cardUID));
            
            this.feedList.appendChild(row);
        });
        
        lucide.createIcons();
    }

    renderInsideList() {
        this.insideList.innerHTML = "";
        const insideStudents = this.students.filter(s => s.isInside);

        if (insideStudents.length === 0) {
            this.insideList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="door-closed"></i>
                    <p>Nobody inside the building right now.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        insideStudents.forEach(student => {
            const item = document.createElement("div");
            item.className = "inside-item";
            
            item.innerHTML = `
                <div class="inside-left">
                    <div class="inside-avatar">
                        <i data-lucide="user"></i>
                    </div>
                    <span class="inside-name">${student.name}</span>
                </div>
                <span class="inside-time-label">Since: <strong>${student.lastTimeIn}</strong></span>
            `;
            
            item.addEventListener("dblclick", () => this.openStudentDossier(student.cardUID));
            this.insideList.appendChild(item);
        });

        lucide.createIcons();
    }

    renderDirectoryList() {
        this.directoryList.innerHTML = "";
        const searchVal = this.directorySearch.value.trim().toLowerCase();
        
        const filtered = this.students.filter(s => 
            s.name.toLowerCase().includes(searchVal) ||
            s.rollNumber.toLowerCase().includes(searchVal) ||
            s.cardUID.toLowerCase().includes(searchVal)
        );

        if (filtered.length === 0) {
            this.directoryList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                        <i data-lucide="users-round" style="width: 36px; height: 36px; margin: 0 auto 0.5rem; display: block;"></i>
                        No students found matching your query.
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        filtered.forEach((student, idx) => {
            // Find index of student in main array
            const originalIndex = this.students.findIndex(s => s.cardUID === student.cardUID);
            
            const tr = document.createElement("tr");

            // Calculate total time
            const studentLogs = this.logs.filter(l => l.cardUID.toLowerCase() === student.cardUID.toLowerCase());
            let totalMs = 0;
            const chronLogs = [...studentLogs].reverse();
            let lastIn = null;
            
            chronLogs.forEach(l => {
                if (l.status === "STUDENT ENTERED") {
                    lastIn = new Date(l.timestamp);
                } else if (l.status === "STUDENT EXITED" && lastIn) {
                    totalMs += (new Date(l.timestamp) - lastIn);
                    lastIn = null;
                }
            });
            if (student.isInside && lastIn) {
                totalMs += (new Date() - lastIn);
            }
            const totalHours = (totalMs / 3600000).toFixed(1);

            // Scans today
            const scansToday = studentLogs.length;

            tr.innerHTML = `
                <td><strong>${student.rollNumber}</strong></td>
                <td>${student.name}</td>
                <td><code class="feed-uid">${student.cardUID}</code></td>
                <td>
                    <span class="table-status-pill ${student.isInside ? 'inside' : 'outside'}">
                        <span class="dot"></span>
                        ${student.isInside ? 'Inside' : 'Outside'}
                    </span>
                </td>
                <td>${totalHours} hrs</td>
                <td>${scansToday} scans</td>
                <td class="actions-col">
                    <div class="actions-cell">
                        <button class="btn btn-outline btn-sm btn-icon-only btn-view-dossier" data-uid="${student.cardUID}" title="View Dossier">
                            <i data-lucide="folder-open"></i>
                        </button>
                        <button class="btn btn-outline btn-sm btn-icon-only btn-edit" data-idx="${originalIndex}" title="Edit Registration">
                            <i data-lucide="edit"></i>
                        </button>
                        <button class="btn btn-outline btn-sm btn-icon-only btn-delete color-rose" data-idx="${originalIndex}" style="border-color: rgba(244, 63, 94, 0.15);" title="Delete Student">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            `;

            // Bind click events to actions
            tr.querySelector(".btn-view-dossier").addEventListener("click", () => this.openStudentDossier(student.cardUID));
            tr.querySelector(".btn-edit").addEventListener("click", () => this.openEditStudentModal(originalIndex));
            tr.querySelector(".btn-delete").addEventListener("click", () => this.deleteStudent(originalIndex));

            this.directoryList.appendChild(tr);
        });

        lucide.createIcons();
    }

    renderSimulatorDropdown() {
        const valBefore = this.simStudentSelect.value;
        this.simStudentSelect.innerHTML = "";
        
        this.students.forEach((student, idx) => {
            const opt = document.createElement("option");
            opt.value = idx.toString();
            opt.textContent = `${student.name} (${student.rollNumber} - ${student.cardUID})`;
            this.simStudentSelect.appendChild(opt);
        });

        if (this.students.length === 0) {
            const opt = document.createElement("option");
            opt.textContent = "No registered students. Use Directory to add.";
            this.simStudentSelect.appendChild(opt);
        } else if (valBefore !== "" && parseInt(valBefore) < this.students.length) {
            this.simStudentSelect.value = valBefore;
        }
    }

    renderAll() {
        this.renderStats();
        this.renderLiveFeed();
        this.renderInsideList();
        this.renderDirectoryList();
        this.renderSimulatorDropdown();

        // Update settings values
        this.configShiftStart.value = this.shiftStartTime;
        this.serialTimestampSelect.value = this.timestampMode;
        this.statPunctSub.textContent = `Shift: ${this.formatTime12Hr(this.shiftStartTime)}`;
    }

    // Chart.js Visualizations Setup
    initCharts() {
        const themeColor = () => document.body.classList.contains("light-theme") ? "#4b5563" : "#9ca3af";
        const gridColor = () => document.body.classList.contains("light-theme") ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";

        // 1. Hourly Activity Chart
        const ctxHourly = document.getElementById("hourlyChart").getContext("2d");
        this.charts.hourly = new Chart(ctxHourly, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`),
                datasets: [
                    { label: 'Entries', data: Array(24).fill(0), backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Exits', data: Array(24).fill(0), backgroundColor: '#f59e0b', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: themeColor(), font: { family: 'Outfit' } } }
                },
                scales: {
                    x: { grid: { color: gridColor() }, ticks: { color: themeColor(), font: { family: 'Outfit' } } },
                    y: { grid: { color: gridColor() }, ticks: { color: themeColor(), font: { family: 'Outfit' }, stepSize: 1, precision: 0 } }
                }
            }
        });

        // 2. Punctuality Breakdown Chart
        const ctxPunct = document.getElementById("punctualityChart").getContext("2d");
        this.charts.punctuality = new Chart(ctxPunct, {
            type: 'doughnut',
            data: {
                labels: ['On-time', 'Late'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderColor: 'transparent',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: themeColor(), font: { family: 'Outfit' } } }
                }
            }
        });

        // 3. Cumulative hours spent inside by student
        const ctxHours = document.getElementById("hoursChart").getContext("2d");
        this.charts.hours = new Chart(ctxHours, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Inside hours',
                    data: [],
                    backgroundColor: '#6366f1',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { color: gridColor() }, ticks: { color: themeColor(), font: { family: 'Outfit' } } },
                    y: { grid: { color: gridColor() }, ticks: { color: themeColor(), font: { family: 'Outfit' } } }
                }
            }
        });

        this.updateCharts();
    }

    updateCharts() {
        if (!this.charts.hourly) return;

        const isLight = document.body.classList.contains("light-theme");
        const themeColor = isLight ? "#4b5563" : "#9ca3af";
        const gridColor = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";

        // Refresh Chart.js colors for light/dark modes
        const updateColors = (chartObj) => {
            if (chartObj.options.scales) {
                if (chartObj.options.scales.x) {
                    chartObj.options.scales.x.grid.color = gridColor;
                    chartObj.options.scales.x.ticks.color = themeColor;
                }
                if (chartObj.options.scales.y) {
                    chartObj.options.scales.y.grid.color = gridColor;
                    chartObj.options.scales.y.ticks.color = themeColor;
                }
            }
            if (chartObj.options.plugins && chartObj.options.plugins.legend) {
                chartObj.options.plugins.legend.labels.color = themeColor;
            }
        };

        Object.values(this.charts).forEach(updateColors);

        // Precompute Hourly Entries vs Exits
        const entriesPerHour = Array(24).fill(0);
        const exitsPerHour = Array(24).fill(0);

        this.logs.forEach(log => {
            // Find timestamp hour
            const date = new Date(log.timestamp);
            const hour = date.getHours();
            
            if (log.status === "STUDENT ENTERED") {
                entriesPerHour[hour]++;
            } else if (log.status === "STUDENT EXITED") {
                exitsPerHour[hour]++;
            }
        });

        this.charts.hourly.data.datasets[0].data = entriesPerHour;
        this.charts.hourly.data.datasets[1].data = exitsPerHour;
        this.charts.hourly.update();

        // Precompute Punctuality
        let onTime = 0;
        let late = 0;

        this.logs.forEach(log => {
            if (log.status === "STUDENT ENTERED") {
                const student = this.students.find(s => s.cardUID === log.cardUID);
                if (student) { // registered student
                    if (this.checkIfTimeLate(log.timeIn, this.shiftStartTime)) {
                        late++;
                    } else {
                        onTime++;
                    }
                }
            }
        });

        this.charts.punctuality.data.datasets[0].data = [onTime, late];
        this.charts.punctuality.update();

        // Precompute Hours inside by student
        const studentNames = [];
        const studentHours = [];

        this.students.forEach(student => {
            const studentLogs = this.logs.filter(l => l.cardUID.toLowerCase() === student.cardUID.toLowerCase());
            let totalMs = 0;
            const chronLogs = [...studentLogs].reverse();
            let lastIn = null;
            
            chronLogs.forEach(l => {
                if (l.status === "STUDENT ENTERED") {
                    lastIn = new Date(l.timestamp);
                } else if (l.status === "STUDENT EXITED" && lastIn) {
                    totalMs += (new Date(l.timestamp) - lastIn);
                    lastIn = null;
                }
            });
            
            if (student.isInside && lastIn) {
                totalMs += (new Date() - lastIn);
            }

            const totalHours = totalMs / 3600000;
            
            studentNames.push(student.name);
            studentHours.push(parseFloat(totalHours.toFixed(2)));
        });

        this.charts.hours.data.labels = studentNames;
        this.charts.hours.data.datasets[0].data = studentHours;
        this.charts.hours.update();
    }

    // CSV/JSON Data Import & Export Features
    exportLogsToCsv() {
        if (this.logs.length === 0) {
            this.showToast("No scan logs available to export", "error");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Log ID,Card UID,Roll Number,Name,Time In,Time Out,Status,Timestamp\n";

        this.logs.forEach(log => {
            const row = [
                log.id,
                log.cardUID,
                log.rollNumber,
                `"${log.name.replace(/"/g, '""')}"`,
                log.timeIn,
                log.timeOut,
                log.status,
                log.timestamp
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `rfid_attendance_export_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast("CSV scan logs downloaded successfully", "success");
    }

    handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        // If file is JSON
        if (file.name.endsWith(".json")) {
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.students && Array.isArray(data.students)) {
                        this.students = data.students;
                        this.saveStudents();
                    }
                    if (data.logs && Array.isArray(data.logs)) {
                        this.logs = data.logs;
                        if (this.logs.length > 0) {
                            // recalculate serial counter
                            const maxId = Math.max(...this.logs.map(l => l.id || 0));
                            this.serialCounter = maxId + 1;
                        }
                        this.saveLogs();
                    }
                    
                    this.renderAll();
                    this.updateCharts();
                    this.showToast("JSON configuration imported successfully", "success");
                } catch (error) {
                    this.showToast("Failed to parse JSON file", "error");
                    console.error("JSON parse error:", error);
                }
            };
            reader.readAsText(file);
        } 
        // If file is CSV
        else if (file.name.endsWith(".csv")) {
            reader.onload = (e) => {
                try {
                    const lines = e.target.result.split("\n");
                    if (lines.length <= 1) {
                        this.showToast("CSV file is empty", "error");
                        return;
                    }

                    // Simple CSV parser
                    const newLogs = [];
                    // Skip header row
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        // Parse values split by comma, respecting quotes
                        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                        if (parts.length >= 7) {
                            const id = parseInt(parts[0]) || this.serialCounter++;
                            const cardUID = parts[1].replace(/["']/g, "").trim().toLowerCase();
                            const rollNumber = parts[2].replace(/["']/g, "").trim();
                            const name = parts[3].replace(/["']/g, "").trim();
                            const timeIn = parts[4].replace(/["']/g, "").trim();
                            const timeOut = parts[5].replace(/["']/g, "").trim();
                            const status = parts[6].replace(/["']/g, "").trim();
                            const timestamp = parts[7] ? parts[7].replace(/["']/g, "").trim() : new Date().toISOString();

                            newLogs.push({
                                id, cardUID, rollNumber, name, timeIn, timeOut, status, timestamp
                            });
                        }
                    }

                    if (newLogs.length > 0) {
                        // Merge logs or replace logs? Let's replace/merge by checking IDs
                        this.logs = [...newLogs, ...this.logs];
                        // Sort by ID descending
                        this.logs.sort((a,b) => b.id - a.id);
                        
                        // Reset counter
                        const maxId = Math.max(...this.logs.map(l => l.id || 0));
                        this.serialCounter = maxId + 1;
                        this.saveLogs();
                        
                        // Re-assess which student is inside based on current log states
                        // Clear active states first
                        this.students.forEach(s => s.isInside = false);
                        
                        // Traverse logs in chronological order to find student final state
                        const chronLogs = [...this.logs].reverse();
                        chronLogs.forEach(log => {
                            const student = this.students.find(s => s.cardUID === log.cardUID);
                            if (student) {
                                if (log.status === "STUDENT ENTERED") {
                                    student.isInside = true;
                                    student.lastTimeIn = log.timeIn;
                                } else if (log.status === "STUDENT EXITED") {
                                    student.isInside = false;
                                }
                            }
                        });
                        this.saveStudents();

                        this.renderAll();
                        this.updateCharts();
                        this.showToast(`Imported ${newLogs.length} logs from CSV`, "success");
                    } else {
                        this.showToast("No valid scan logs found in CSV", "error");
                    }
                } catch (error) {
                    this.showToast("Failed to parse CSV file", "error");
                    console.error("CSV parse error:", error);
                }
            };
            reader.readAsText(file);
        } else {
            this.showToast("Unsupported file format. Please upload .csv or .json files.", "error");
        }

        // reset file input
        this.importCsvFile.value = "";
    }

    // Dynamic Toast System
    showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let iconName = "info";
        if (type === "success") iconName = "check-circle";
        if (type === "error") iconName = "alert-circle";
        
        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        lucide.createIcons();
        
        // Remove toast after animation
        setTimeout(() => {
            toast.style.animation = "slideInRight 0.3s reverse forwards";
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3500);
    }
}

// Instantiate App
document.addEventListener("DOMContentLoaded", () => {
    window.app = new RFIDAttendanceApp();
});
