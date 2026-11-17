import { auth, db } from './firebase-config.js';
import { collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, getDocsFromCache, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initAuth, signUpWithEmail, signInWithEmail, signInWithGoogle, appSignOut, resetPassword } from './auth.js';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const noteInput = document.getElementById('note-input');
const noteTitle = document.getElementById('note-title');
const notesList = document.getElementById('notes-list');
const saveStatus = document.getElementById('save-status');
const mainContainer = document.querySelector('.main-container');
const searchInput = document.getElementById('search-input');

let currentUser = null;
let currentNoteId = null;
let unsubscribeFromNotes = null;
let debounceTimer = null;
let actionPending = null;
let actionTimer = null;
let allNotes = [];
let searchDebounceTimer = null;
let notesListenerRetryTimer = null;

// --- Theme Logic ---
// Theme initialization is now handled in index.html head to prevent FOUC

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// --- Safe Decompression Helper ---
function lenientDecompressUTF16(compressedStr) {
    if (!compressedStr) return '';
    const length = compressedStr.length;
    const resetValue = 16384;
    const getNextValue = (o) => compressedStr.charCodeAt(o) - 32;

    var dictionary = [], enlargeIn = 4, dictSize = 4, numBits = 3, entry = '', result = [], i, w, bits, resb, maxpower, power, c;
    var data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (i = 0; i < 3; i += 1) dictionary[i] = i;

    bits = 0; maxpower = Math.pow(2, 2); power = 1;
    while (power != maxpower) {
        resb = data.val & data.position; data.position >>= 1;
        if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
        bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
    }

    switch (bits) {
        case 0:
            bits = 0; maxpower = Math.pow(2, 8); power = 1;
            while (power != maxpower) {
                resb = data.val & data.position; data.position >>= 1;
                if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
            }
            c = String.fromCharCode(bits);
            break;
        case 1:
            bits = 0; maxpower = Math.pow(2, 16); power = 1;
            while (power != maxpower) {
                resb = data.val & data.position; data.position >>= 1;
                if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
            }
            c = String.fromCharCode(bits);
            break;
        case 2: return '';
    }
    dictionary[3] = c; w = c; result.push(c);

    while (true) {
        if (data.index > length) return result.join('');
        bits = 0; maxpower = Math.pow(2, numBits); power = 1;
        while (power != maxpower) {
            resb = data.val & data.position; data.position >>= 1;
            if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
            bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
        }

        switch (c = bits) {
            case 0:
                bits = 0; maxpower = Math.pow(2, 8); power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position; data.position >>= 1;
                    if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                    bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
                }
                dictionary[dictSize++] = String.fromCharCode(bits); c = dictSize - 1; enlargeIn--;
                break;
            case 1:
                bits = 0; maxpower = Math.pow(2, 16); power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position; data.position >>= 1;
                    if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                    bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
                }
                dictionary[dictSize++] = String.fromCharCode(bits); c = dictSize - 1; enlargeIn--;
                break;
            case 2: return result.join('');
        }

        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
        if (dictionary[c]) {
            entry = dictionary[c];
        } else {
            if (c === dictSize) entry = w + w.charAt(0);
            else return result.join('');
        }
        result.push(entry);
        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn--;
        w = entry;
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
    }
}

function safeDecompress(raw, isCompressed) {
    if (!raw) return '';
    if (!isCompressed) return raw;
    try {
        const decomp = LZString.decompressFromUTF16(raw);
        if (decomp !== null) return decomp;
    } catch (_) {}
    try {
        const lenient = lenientDecompressUTF16(raw);
        if (lenient) return lenient;
    } catch (_) {}
    return raw;
}

// --- Note Sorting and Content Processing ---
function getNoteTime(note) {
    if (!note) return 0;
    const t = note.updatedAt || note.createdAt;
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (t instanceof Date) return t.getTime();
    if (typeof t === 'number') return t;
    if (typeof t === 'string') {
        const parsed = new Date(t).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function sortNotes(notes) {
    return [...notes].sort((a, b) => getNoteTime(b) - getNoteTime(a));
}

function processNoteContent(noteData) {
    if (!noteData) return;
    const newTitle = noteData.title || '';
    if (noteTitle.value !== newTitle) {
        noteTitle.value = newTitle;
    }

    let content = safeDecompress(noteData.content, noteData.isCompressed);

    if (noteInput.value !== content) {
        const isFocused = (document.activeElement === noteInput);
        const cursorPosition = noteInput.selectionStart;
        noteInput.value = content;

        const query = searchInput.value.trim().toLowerCase();
        if (query && !isFocused) {
            const lowerContent = content.toLowerCase();
            const index = lowerContent.indexOf(query);
            if (index !== -1) {
                setTimeout(() => {
                     noteInput.focus();
                     noteInput.setSelectionRange(index, index + query.length);
                }, 100);
            }
        } else if (isFocused) {
            const newPos = Math.min(cursorPosition, content.length);
            noteInput.setSelectionRange(newPos, newPos);
        }
    }
}

// --- Guest Mode Storage Helper ---
const GuestStore = {
    getKey: () => 'synote_guest_notes',
    getAllNotes: () => {
        const data = localStorage.getItem(GuestStore.getKey());
        return data ? JSON.parse(data) : [];
    },
    saveAllNotes: (notes) => {
        localStorage.setItem(GuestStore.getKey(), JSON.stringify(notes));
    },
    getNote: (id) => {
        const notes = GuestStore.getAllNotes();
        return notes.find(n => n.id === id);
    },
    addNote: (note) => {
        const notes = GuestStore.getAllNotes();
        notes.unshift(note);
        GuestStore.saveAllNotes(notes);
    },
    updateNote: (id, updates) => {
        const notes = GuestStore.getAllNotes();
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes[index] = { ...notes[index], ...updates };
            GuestStore.saveAllNotes(notes);
        }
    },
    deleteNote: (id) => {
        const notes = GuestStore.getAllNotes();
        const newNotes = notes.filter(n => n.id !== id);
        GuestStore.saveAllNotes(newNotes);
    }
};

// --- UI Functions ---
export function showLoginView() {
    localStorage.removeItem('synote_logged_in');
    localStorage.removeItem('synote_uid');
    localStorage.removeItem('synote_active_note_id');
    if (unsubscribeFromNotes) {
        unsubscribeFromNotes();
        unsubscribeFromNotes = null;
    }
    currentUser = null;
    currentNoteId = null;
    allNotes = [];
    document.documentElement.classList.remove('is-logged-in');
    mainContainer.classList.remove('is-app-view');
    appView.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        appView.classList.add('hidden');
        loginView.classList.remove('hidden');
        loginView.classList.remove('opacity-0', 'scale-95');
    }, 300);
}

export function showAppView() {
    localStorage.setItem('synote_logged_in', 'true');
    document.documentElement.classList.add('is-logged-in');
    loginView.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        mainContainer.classList.add('is-app-view');
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        appView.classList.remove('opacity-0', 'scale-95');
    }, 300);
}

function renderNotesList(notes) {
    notesList.innerHTML = '';
    if (notes.length === 0) {
        if (searchInput.value.trim() !== '') {
            notesList.innerHTML = '<p class="text-muted-foreground text-center mt-4 text-sm">No matching notes found.</p>';
        } else {
            notesList.innerHTML = '<p class="text-muted-foreground text-center mt-4 text-sm">No notes yet.</p>';
            noteTitle.value = '';
            noteInput.value = '';
            noteTitle.disabled = true;
            noteInput.disabled = true;
        }
        return;
    }

    noteTitle.disabled = false;
    noteInput.disabled = false;

    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.classList.add('note-item', 'flex', 'justify-between', 'items-center', 'rounded-md', 'px-3', 'py-2', 'text-sm', 'cursor-pointer', 'transition-colors', 'hover:bg-accent', 'hover:text-accent-foreground', 'group');
        noteElement.dataset.id = note.id;
        if (note.id === currentNoteId) {
            noteElement.classList.add('bg-accent', 'text-accent-foreground', 'font-medium');
        }
        noteElement.innerHTML = `
            <span class="note-item-title truncate flex-1 mr-2">${note.title || 'Untitled Note'}</span>
        `;
        noteElement.addEventListener('click', () => loadNote(note.id));
        notesList.appendChild(noteElement);
    });
}

function loadNote(id) {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        saveNote();
    }

    currentNoteId = id;
    localStorage.setItem('synote_active_note_id', id);

    noteTitle.disabled = false;
    noteInput.disabled = false;

    if (currentUser && currentUser.isAnonymous) {
        const noteData = GuestStore.getNote(id);
        if (noteData) {
            processNoteContent(noteData);
        }
        updateActiveNoteInList(id);
        return;
    }

    // Instantly display note data from allNotes
    const existingNote = allNotes.find(n => n.id === id);
    if (existingNote) {
        processNoteContent(existingNote);
    }

    updateActiveNoteInList(id);
}

function updateActiveNoteInList(id) {
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('bg-accent', 'text-accent-foreground', 'font-medium');
    });
    const activeNoteElement = document.querySelector(`.note-item[data-id='${id}']`);
    if (activeNoteElement) {
        activeNoteElement.classList.add('bg-accent', 'text-accent-foreground', 'font-medium');
    }
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('sidebar-open');
        document.getElementById('sidebar').classList.add('-translate-x-full'); // Ensure it closes on mobile
        document.getElementById('content-overlay').classList.add('hidden');
    }
}

function calculateStorageUsage() {
    try {
        const jsonString = JSON.stringify(allNotes);
        const blob = new Blob([jsonString]);
        return blob.size;
    } catch (e) {
        return 0;
    }
}

function updateStorageIndicator() {
    const totalBytes = calculateStorageUsage();
    const limitBytes = 950272; // 928 KB (Safe limit)
    const percentage = Math.min((totalBytes / limitBytes) * 100, 100);

    const sizeText = `${(totalBytes / 1024).toFixed(1)} KB`;

    const storageText = document.getElementById('storage-text');
    const storageBar = document.getElementById('storage-bar');

    if (storageText) storageText.textContent = `${sizeText} / 928 KB`;
    if (storageBar) {
        storageBar.style.width = `${percentage}%`;

        storageBar.classList.remove('bg-primary', 'bg-green-500', 'bg-yellow-500', 'bg-red-500');
        if (percentage > 90) {
            storageBar.classList.add('bg-red-500');
        } else if (percentage > 70) {
            storageBar.classList.add('bg-yellow-500');
        } else {
            storageBar.classList.add('bg-green-500');
        }
    }
}

export function handleUserLogin(user) {
    if (currentUser && currentUser.uid === user.uid && unsubscribeFromNotes) {
        currentUser = user;
        const emailDisplay = document.getElementById('user-email-display');
        if (emailDisplay) {
            emailDisplay.textContent = user.isAnonymous ? 'Guest User' : (user.email || 'User');
        }
        return;
    }

    currentUser = user;
    if (unsubscribeFromNotes) {
        unsubscribeFromNotes();
        unsubscribeFromNotes = null;
    }

    searchInput.value = '';

    // Update profile email
    const emailDisplay = document.getElementById('user-email-display');
    if (emailDisplay) {
        emailDisplay.textContent = user.isAnonymous ? 'Guest User' : (user.email || 'User');
    }

    if (user.isAnonymous) {
        allNotes = sortNotes(GuestStore.getAllNotes());
        renderNotesList(allNotes);
        updateStorageIndicator();
        if (allNotes.length > 0 && !currentNoteId) {
            loadNote(allNotes[0].id);
        } else if (allNotes.length === 0) {
            currentNoteId = null;
        }
        showAppView();
        return;
    }

    localStorage.setItem('synote_uid', user.uid);

    const notesCollectionRef = collection(db, "users", currentUser.uid, "notes");
    const q = query(notesCollectionRef, orderBy("createdAt", "desc"));

    unsubscribeFromNotes = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        const isInitialCacheEmpty = snapshot.metadata.fromCache && snapshot.empty;
        if (isInitialCacheEmpty && allNotes.length === 0) {
            notesList.innerHTML = '<p class="text-muted-foreground text-center mt-4 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Loading notes...</p>';
            return;
        }

        allNotes = sortNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        updateStorageIndicator();

        const queryStr = searchInput.value.trim().toLowerCase();
        if (queryStr) {
             performSearch(queryStr);
        } else {
             renderNotesList(allNotes);
        }

        const savedActiveId = localStorage.getItem('synote_active_note_id');
        const hasCurrentNote = currentNoteId && allNotes.some(n => n.id === currentNoteId);

        if (allNotes.length > 0) {
            if (!currentNoteId) {
                const targetId = (savedActiveId && allNotes.some(n => n.id === savedActiveId))
                    ? savedActiveId
                    : allNotes[0].id;
                loadNote(targetId);
            } else if (!hasCurrentNote) {
                // Current note was deleted remotely
                loadNote(allNotes[0].id);
            } else {
                // Real-time cross-device sync: update active note if not currently typing locally
                const currentNote = allNotes.find(n => n.id === currentNoteId);
                if (currentNote && !debounceTimer) {
                    processNoteContent(currentNote);
                }
            }
        } else {
            currentNoteId = null;
            noteTitle.value = '';
            noteInput.value = '';
            noteTitle.disabled = true;
            noteInput.disabled = true;
        }
    }, (error) => {
        console.error("Notes collection subscription error:", error);
        if (unsubscribeFromNotes) {
            unsubscribeFromNotes();
        }
        unsubscribeFromNotes = null;
        // Retry after 5 seconds — re-establish collection listener
        clearTimeout(notesListenerRetryTimer);
        notesListenerRetryTimer = setTimeout(() => {
            if (currentUser && currentUser.uid === user.uid && !currentUser.isAnonymous && !unsubscribeFromNotes) {
                console.log("Retrying notes collection listener...");
                handleUserLogin(currentUser);
            }
        }, 5000);
    });

    showAppView();
}

function performSearch(query) {
    if (!query) {
        renderNotesList(allNotes);
        return;
    }

    const lowerQuery = query.toLowerCase();

    const filteredNotes = allNotes.filter(note => {
        if (note.title && note.title.toLowerCase().includes(lowerQuery)) {
            return true;
        }

        const content = safeDecompress(note.content, note.isCompressed);
        return content.toLowerCase().includes(lowerQuery);
    });

    renderNotesList(filteredNotes);
}

async function createNewNote() {
    if (!currentUser) return;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        saveNote();
    }

    const compressedContent = LZString.compressToUTF16("");
    const now = new Date();
    const newNote = {
        title: "Untitled Note",
        content: compressedContent,
        isCompressed: true,
        createdAt: currentUser.isAnonymous ? now.toISOString() : now,
        updatedAt: currentUser.isAnonymous ? now.toISOString() : now
    };

    if (currentUser.isAnonymous) {
        const id = 'guest_' + Date.now();
        newNote.id = id;
        GuestStore.addNote(newNote);
        allNotes = sortNotes(GuestStore.getAllNotes());
        updateStorageIndicator();

        searchInput.value = '';
        renderNotesList(allNotes);
        loadNote(id);
        return;
    }

    const notesCollectionRef = collection(db, "users", currentUser.uid, "notes");
    try {
        const docRef = await addDoc(notesCollectionRef, newNote);
        searchInput.value = '';
        loadNote(docRef.id);
    } catch (error) {
        console.error("Error creating new note:", error);
        showMessage("Failed to create new note.", 'error');
    }
}

async function renameNote(noteId, currentTitle) {
    const newTitle = prompt("Enter new title:", currentTitle);
    if (newTitle && newTitle.trim() !== "") {
        const now = new Date();
        if (currentUser.isAnonymous) {
            GuestStore.updateNote(noteId, { title: newTitle, updatedAt: now.toISOString() });
            allNotes = sortNotes(GuestStore.getAllNotes());
            updateStorageIndicator();

            const query = searchInput.value.trim().toLowerCase();
            if (query) performSearch(query);
            else renderNotesList(allNotes);

            if (currentNoteId === noteId) noteTitle.value = newTitle;
            showMessage("Note renamed.", 'success');
            return;
        }

        const noteDocRef = doc(db, "users", currentUser.uid, "notes", noteId);
        try {
            await setDoc(noteDocRef, { title: newTitle, updatedAt: now }, { merge: true });
            const noteIndex = allNotes.findIndex(n => n.id === noteId);
            if (noteIndex !== -1) {
                allNotes[noteIndex].title = newTitle;
                allNotes[noteIndex].updatedAt = now;
                allNotes = sortNotes(allNotes);
                renderNotesList(allNotes);
            }
            if (currentNoteId === noteId) {
                noteTitle.value = newTitle;
            }
            showMessage("Note renamed.", 'success');
        } catch (error) {
            console.error("Error renaming note:", error);
            showMessage("Failed to rename note.", 'error');
        }
    }
}

async function deleteNote(noteId) {
    if (actionPending === `delete-${noteId}`) {
        clearTimeout(actionTimer);
        actionPending = null;
        if (!currentUser || !noteId) return;

        if (debounceTimer && currentNoteId === noteId) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }

        if (localStorage.getItem('synote_active_note_id') === noteId) {
            localStorage.removeItem('synote_active_note_id');
        }

        if (currentUser.isAnonymous) {
            GuestStore.deleteNote(noteId);
            allNotes = sortNotes(GuestStore.getAllNotes());
            updateStorageIndicator();

            if (currentNoteId === noteId) {
                currentNoteId = null;
            }

            const query = searchInput.value.trim().toLowerCase();
            if (query) performSearch(query);
            else renderNotesList(allNotes);

            if (allNotes.length > 0) {
                loadNote(allNotes[0].id);
            }

            showMessage("Note deleted.", 'success');
            return;
        }

        const noteDocRef = doc(db, "users", currentUser.uid, "notes", noteId);
        try {
            await deleteDoc(noteDocRef);
            if (currentNoteId === noteId) {
                currentNoteId = null;
            }
            showMessage("Note deleted.", 'success');
        } catch (error) {
            console.error("Error deleting note:", error);
            showMessage("Failed to delete note.", 'error');
        }
    } else {
        actionPending = `delete-${noteId}`;
        showMessage("Click again to confirm Deletion!", 'info');
        actionTimer = setTimeout(() => { actionPending = null; }, 5000);
    }
}

function saveNote() {
    if (!currentUser || !currentNoteId) return;
    saveStatus.textContent = "Saving...";

    const contentToSave = LZString.compressToUTF16(noteInput.value);
    const now = new Date();

    if (currentUser.isAnonymous) {
        GuestStore.updateNote(currentNoteId, {
            title: noteTitle.value,
            content: contentToSave,
            isCompressed: true,
            updatedAt: now.toISOString()
        });
        const noteIndex = allNotes.findIndex(n => n.id === currentNoteId);
        if (noteIndex !== -1) {
            allNotes[noteIndex].title = noteTitle.value;
            allNotes[noteIndex].content = contentToSave;
            allNotes[noteIndex].isCompressed = true;
            allNotes[noteIndex].updatedAt = now.toISOString();
            allNotes = sortNotes(allNotes);
            renderNotesList(allNotes);
        }

        saveStatus.textContent = "Saved (Local)";
        updateStorageIndicator();
        return;
    }

    const noteDocRef = doc(db, "users", currentUser.uid, "notes", currentNoteId);

    // Keep allNotes in sync locally and sort by most recent edit
    const noteIndex = allNotes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
        allNotes[noteIndex].title = noteTitle.value;
        allNotes[noteIndex].content = contentToSave;
        allNotes[noteIndex].isCompressed = true;
        allNotes[noteIndex].updatedAt = now;
        allNotes = sortNotes(allNotes);
        renderNotesList(allNotes);
    }

    setDoc(noteDocRef, {
        title: noteTitle.value,
        content: contentToSave,
        isCompressed: true,
        updatedAt: now
    }, { merge: true })
        .then(() => {
            saveStatus.textContent = navigator.onLine ? "Saved" : "Saved (Offline)";
        })
        .catch(error => {
            console.error("Error saving note:", error);
            saveStatus.textContent = "Error saving.";
        });
}

function debouncedSave() {
    clearTimeout(debounceTimer);
    saveStatus.textContent = "Typing...";
    debounceTimer = setTimeout(saveNote, 500);
}

// --- Event Listeners ---
function setupEventListeners() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    
    document.getElementById('email-signup-btn').addEventListener('click', () => signUpWithEmail(emailInput.value, passwordInput.value));
    document.getElementById('email-signin-btn').addEventListener('click', () => signInWithEmail(emailInput.value, passwordInput.value));
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('forgot-password-btn').addEventListener('click', () => resetPassword(emailInput.value));

    document.getElementById('guest-signin-btn').addEventListener('click', () => {
        handleUserLogin({ uid: 'guest', isAnonymous: true });
    });

    noteTitle.addEventListener('input', debouncedSave);
    noteInput.addEventListener('input', debouncedSave);

    // Auto-math evaluation
    noteInput.addEventListener('keydown', (e) => {
        if (e.key === '=' || e.key === 'Enter') {
            // Check if we should calculate. Simple check: last non-whitespace char is a digit or ')'
            // We use setTimeout to let the character be inserted first if it's '='
            setTimeout(() => {
                const val = noteInput.value;
                const cursorPos = noteInput.selectionStart;

                // If enter was pressed, we might be on a new line, so check previous line
                // If = was pressed, we are right after it.
                // This logic is simplified for now. The previous memory says "When a user types an expression ending with an equals sign ('=')"

                if (e.key === '=') {
                    // Look backwards from cursor
                    const textBeforeCursor = val.substring(0, cursorPos);
                    // Find the expression.
                    // This is a naive implementation; a robust one would parse carefully.
                    // Let's assume the expression is on the same line.
                    const lines = textBeforeCursor.split('\n');
                    const currentLine = lines[lines.length - 1];
                    // Remove the trailing '='
                    const expression = currentLine.slice(0, -1).trim();

                    if (expression && /[\d)]$/.test(expression)) {
                        try {
                           const parser = new exprEval.Parser();
                           const result = parser.evaluate(expression);
                           if (result !== undefined && !isNaN(result)) {
                               // Append result
                               const newVal = val.substring(0, cursorPos) + " " + result + val.substring(cursorPos);
                               noteInput.value = newVal;
                               noteInput.setSelectionRange(cursorPos + String(result).length + 1, cursorPos + String(result).length + 1);

                               // Add glow effect
                               noteInput.classList.add('result-glow-animate');
                               setTimeout(() => noteInput.classList.remove('result-glow-animate'), 1000);

                               saveNote();
                           }
                        } catch (err) {
                           // Ignore evaluation errors
                        }
                    }
                }
            }, 0);
        }
    });

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            performSearch(e.target.value.trim());
        }, 300);
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        // Toggle transform classes
        if (sidebar.classList.contains('-translate-x-full')) {
             sidebar.classList.remove('-translate-x-full');
             document.getElementById('content-overlay').classList.remove('hidden');
        } else {
             sidebar.classList.add('-translate-x-full');
             document.getElementById('content-overlay').classList.add('hidden');
        }
    });

    document.getElementById('content-overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('content-overlay').classList.add('hidden');
    });

    document.getElementById('new-note-btn').addEventListener('click', createNewNote);

    document.getElementById('settings-btn').addEventListener('click', function() {
        const bubble = document.getElementById('settings-bubble');
        bubble.classList.toggle('hidden');
        this.classList.toggle('bg-accent');
        this.classList.toggle('text-accent-foreground');
    });

    document.getElementById('rename-note-btn').addEventListener('click', () => {
        if (currentNoteId) {
            // Close the bubble and reset settings button state
            const bubble = document.getElementById('settings-bubble');
            bubble.classList.add('hidden');
            const settingsBtn = document.getElementById('settings-btn');
            settingsBtn.classList.remove('bg-accent', 'text-accent-foreground');

            // Focus and select title input
            noteTitle.focus();
            noteTitle.select();
        } else {
            showMessage("No note selected.", 'error');
        }
    });

    document.getElementById('delete-note-btn').addEventListener('click', () => {
        if (currentNoteId) {
            deleteNote(currentNoteId);
        } else {
            showMessage("No note selected.", 'error');
        }
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if (!currentNoteId) return;
        if (actionPending === 'clear') {
            clearTimeout(actionTimer);
            actionPending = null;
            noteInput.value = "";
            saveNote();
            showMessage("Note cleared.", 'success');
        } else {
            actionPending = 'clear';
            showMessage("Click again to Erase this note!", 'info');
            clearTimeout(actionTimer);
            actionTimer = setTimeout(() => {
                actionPending = null;
            }, 5000);
        }
    });

    // Theme toggle listeners
    document.querySelectorAll('#global-theme-toggle, #sidebar-theme-toggle').forEach(btn => {
        btn.addEventListener('click', toggleTheme);
    });

    const passwordToggleBtn = document.getElementById('password-toggle-btn');
    const passwordToggleIcon = document.getElementById('password-toggle-icon');
    
    passwordToggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        if (isPassword) {
            passwordInput.type = 'text';
            passwordToggleIcon.classList.remove('fa-eye');
            passwordToggleIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            passwordToggleIcon.classList.remove('fa-eye-slash');
            passwordToggleIcon.classList.add('fa-eye');
        }
    });

    // Profile Dropdown Toggle
    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                profileDropdown.classList.add('hidden');
            }
        });
    }

    const signOutBtn = document.getElementById('dropdown-sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            if (actionPending === 'signout') {
                clearTimeout(actionTimer);
                actionPending = null;
                profileDropdown.classList.add('hidden'); // Close dropdown
                if (currentUser.isAnonymous) {
                    currentUser = null;
                    allNotes = [];
                    showLoginView();
                    noteTitle.value = '';
                    noteInput.value = '';
                    notesList.innerHTML = '';
                } else {
                    appSignOut();
                }
            } else {
                actionPending = 'signout';
                showMessage("Click again to sign out.", 'info');
                clearTimeout(actionTimer);
                actionTimer = setTimeout(() => {
                    actionPending = null;
                }, 5000);
            }
        });
    }

    document.getElementById('copy-all-btn').addEventListener('click', () => {
        if (noteInput.value) {
            navigator.clipboard.writeText(noteInput.value)
                .then(() => showMessage("Copied!", 'success'))
                .catch(err => showMessage("Failed to copy.", 'error'));
        }
    });

    document.getElementById('paste-all-btn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                noteInput.value += text;
                saveNote();
            }
        } catch (err) {
            showMessage("Failed to paste.", 'error');
        }
    });

    // Flush pending saves before unload or when tab is hidden
    window.addEventListener('beforeunload', () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
            saveNote();
        }
    });

    // Re-establish listeners when network comes back online
    window.addEventListener('online', () => {
        if (currentUser && !currentUser.isAnonymous) {
            saveStatus.textContent = "Online";
            if (!unsubscribeFromNotes) {
                console.log("Network online, re-establishing notes listener...");
                handleUserLogin(currentUser);
            }
        }
    });

    window.addEventListener('offline', () => {
        saveStatus.textContent = "Offline";
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
            saveNote();
        }
        // Re-establish listeners when tab becomes visible again (e.g., laptop lid reopen)
        if (document.visibilityState === 'visible' && currentUser && !currentUser.isAnonymous) {
            if (!unsubscribeFromNotes) {
                console.log("Tab visible again, re-establishing notes listener...");
                handleUserLogin(currentUser);
            }
        }
    });
}

// --- Utility Functions ---
export function showMessage(msg, type = 'info') {
    const messageDisplay = document.getElementById('message-display');
    const messageText = document.getElementById('message-text');
    messageText.textContent = msg;

    // Shadcn toast style
    messageDisplay.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-5 md:right-5 z-50 px-4 py-3 rounded-md shadow-lg border transition-all duration-300 transform translate-y-0 opacity-100 flex items-center gap-2 text-sm w-[90%] md:w-auto justify-center md:justify-start';

    if (type === 'error') {
        messageDisplay.classList.add('bg-destructive', 'text-destructive-foreground', 'border-destructive');
    } else if (type === 'info') {
        messageDisplay.classList.add('bg-background', 'text-foreground', 'border-border');
    } else {
        messageDisplay.classList.add('bg-background', 'text-foreground', 'border-border');
        // Success could be green, but shadcn usually uses simple toasts or colored borders
        // Let's stick to simple clean look, maybe with an icon if I had one easily.
    }

    messageDisplay.classList.add('show');
    setTimeout(() => {
        messageDisplay.classList.remove('opacity-100', 'translate-y-0');
        messageDisplay.classList.add('opacity-0', 'translate-y-2');
    }, 3000);
}

export function setButtonLoadingState(button, isLoading) {
    const spinner = button.querySelector('.fa-spinner');
    const content = button.querySelector('.button-content');
    const googleIcon = button.querySelector('.google-icon');

    if (isLoading) {
        if (content) content.classList.add('hidden');
        if (googleIcon) googleIcon.classList.add('hidden'); // Also hide google icon if loading
        if (spinner) spinner.classList.remove('hidden');
        button.disabled = true;
    } else {
        if (content) content.classList.remove('hidden');
        if (googleIcon) googleIcon.classList.remove('hidden');
        if (spinner) spinner.classList.add('hidden');
        button.disabled = false;
    }
}

// --- App Initialization ---
async function eagerLoadNotes() {
    const cachedUid = localStorage.getItem('synote_uid');
    const isLoggedIn = localStorage.getItem('synote_logged_in') === 'true';
    if (cachedUid && isLoggedIn) {
        try {
            const notesCollectionRef = collection(db, "users", cachedUid, "notes");
            const q = query(notesCollectionRef, orderBy("createdAt", "desc"));
            const snapshot = await getDocsFromCache(q);
            // Only populate from cache if auth hasn't already initialized live listener
            if (!unsubscribeFromNotes && !snapshot.empty) {
                allNotes = sortNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                updateStorageIndicator();
                renderNotesList(allNotes);
                const savedActiveId = localStorage.getItem('synote_active_note_id');
                const targetNote = (savedActiveId && allNotes.find(n => n.id === savedActiveId)) || allNotes[0];
                if (targetNote && !currentNoteId) {
                    loadNote(targetNote.id);
                }
            }
        } catch (e) {
            console.debug("Eager cache read not available:", e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    eagerLoadNotes();
    setupEventListeners();
    initAuth();
});
