const SUPABASE_SCRIPT_URL =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

let supabaseClient = null;

let presentations = [];
let currentPresentationIndex = -1;
let currentFilter = "Alle";

let timerInterval = null;
let timerSeconds = 180;
let timerRunning = false;


/* =========================================
   INITIALIZATION
========================================= */

async function init() {

    if (
        !window.APP_CONFIG ||
        !window.APP_CONFIG.SUPABASE_URL ||
        !window.APP_CONFIG.SUPABASE_ANON_KEY ||
        window.APP_CONFIG.SUPABASE_URL.includes("PASTE_")
    ) {
        showToast("Supabase ist noch nicht konfiguriert.");
        return;
    }

    try {

        await loadSupabase();

        supabaseClient = window.supabase.createClient(
            window.APP_CONFIG.SUPABASE_URL,
            window.APP_CONFIG.SUPABASE_ANON_KEY
        );

        await loadPresentations();

        setupEvents();

    } catch (error) {

        console.error(error);

        showToast(
            "Fehler beim Laden der Anwendung."
        );
    }
}


/* =========================================
   SUPABASE
========================================= */

function loadSupabase() {

    return new Promise((resolve, reject) => {

        if (window.supabase) {
            resolve();
            return;
        }

        const script = document.createElement("script");

        script.src = SUPABASE_SCRIPT_URL;

        script.onload = resolve;

        script.onerror = () => {
            reject(
                new Error("Supabase konnte nicht geladen werden.")
            );
        };

        document.head.appendChild(script);
    });
}


async function loadPresentations() {

    const {
        data,
        error
    } = await supabaseClient
        .from("presentations")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(error);
        showToast("Präsentationen konnten nicht geladen werden.");
        return;
    }

    presentations = data || [];

    renderEverything();
}


/* =========================================
   RENDER
========================================= */

function renderEverything() {

    renderStats();
    renderParticipants();
    renderPresentations();
    renderFilters();
    renderHeroProgress();
}


function renderStats() {

    const total = presentations.length;

    const finished = presentations.filter(
        item => item.status === "Fertig"
    ).length;

    const inProgress = presentations.filter(
        item => item.status === "In Arbeit"
    ).length;

    const participants = [
        ...new Set(
            presentations
                .map(item => item.name)
                .filter(Boolean)
        )
    ];


    document.getElementById("statPresentations").textContent =
        total;

    document.getElementById("statParticipants").textContent =
        participants.length;

    document.getElementById("statFinished").textContent =
        finished;

    document.getElementById("statProgress").textContent =
        inProgress;
}


function renderHeroProgress() {

    const total = presentations.length;

    const finished = presentations.filter(
        item => item.status === "Fertig"
    ).length;

    const percent = total
        ? Math.round((finished / total) * 100)
        : 0;


    document.getElementById("heroProgress").textContent =
        `${percent}%`;

    document.getElementById("progressCircleText").textContent =
        `${percent}%`;

    document.getElementById("heroProgressBar").style.width =
        `${percent}%`;

    document.getElementById("heroFinished").textContent =
        `${finished} von ${total} Themen fertig`;
}


function renderParticipants() {

    const container =
        document.getElementById("participantsGrid");

    if (!presentations.length) {
        container.innerHTML = "";
        return;
    }


    const people = {};


    presentations.forEach(item => {

        if (!item.name) return;

        if (!people[item.name]) {
            people[item.name] = {
                total: 0,
                finished: 0
            };
        }

        people[item.name].total++;

        if (item.status === "Fertig") {
            people[item.name].finished++;
        }
    });


    const sortedPeople =
        Object.entries(people)
            .sort((a, b) =>
                a[0].localeCompare(
                    b[0],
                    "de"
                )
            );


    container.innerHTML =
        sortedPeople
            .map(([name, stats]) => {

                const percent = stats.total
                    ? Math.round(
                        stats.finished /
                        stats.total *
                        100
                    )
                    : 0;

                return `
                    <div class="person-card">

                        <div class="person-top">

                            <div class="avatar">
                                ${getInitials(name)}
                            </div>

                            <div>
                                <div class="person-name">
                                    ${escapeHtml(name)}
                                </div>

                                <div class="person-count">
                                    ${stats.total}
                                    ${stats.total === 1 ? "Thema" : "Themen"}
                                </div>
                            </div>

                        </div>

                        <div class="person-progress">

                            <div class="person-progress-top">
                                <span>Fortschritt</span>
                                <span>${percent}%</span>
                            </div>

                            <div class="mini-progress">
                                <div
                                    class="mini-progress-fill"
                                    style="width:${percent}%"
                                ></div>
                            </div>

                        </div>

                    </div>
                `;
            })
            .join("");
}


function renderFilters() {

    const all = presentations.length;

    const finished =
        presentations.filter(
            item => item.status === "Fertig"
        ).length;

    const progress =
        presentations.filter(
            item => item.status === "In Arbeit"
        ).length;


    document.getElementById("filterAllCount").textContent =
        all;

    document.getElementById("filterFinishedCount").textContent =
        finished;

    document.getElementById("filterProgressCount").textContent =
        progress;
}


function renderPresentations() {

    const container =
        document.getElementById("presentationsGrid");

    const empty =
        document.getElementById("emptyState");

    const search =
        document
            .getElementById("searchInput")
            .value
            .trim()
            .toLowerCase();


    let filtered =
        presentations.filter(item => {

            const matchesStatus =
                currentFilter === "Alle" ||
                item.status === currentFilter;

            const searchable = [
                item.name,
                item.title,
                item.text,
                item.vocabulary,
                item.questions
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            const matchesSearch =
                !search ||
                searchable.includes(search);


            return matchesStatus && matchesSearch;
        });


    if (!filtered.length) {

        container.innerHTML = "";

        empty.classList.remove("hidden");

        return;
    }


    empty.classList.add("hidden");


    container.innerHTML =
        filtered
            .map(item => {

                const statusClass =
                    item.status === "Fertig"
                        ? "finished"
                        : "progress";


                const preview =
                    item.text
                        ? item.text.replace(/\s+/g, " ").trim()
                        : "";


                const vocabularyCount =
                    splitLines(item.vocabulary).length;

                const questionCount =
                    splitLines(item.questions).length;


                return `
                    <article
                        class="presentation-card"
                        data-id="${item.id}"
                    >

                        <div class="card-top">

                            <span class="status-badge ${statusClass}">
                                ${escapeHtml(item.status)}
                            </span>

                            <span class="card-author">
                                ${escapeHtml(item.name)}
                            </span>

                        </div>


                        <h3 class="card-title">
                            ${escapeHtml(item.title)}
                        </h3>


                        <p class="card-preview">
                            ${escapeHtml(preview)}
                        </p>


                        <div class="card-bottom">

                            <div class="card-info">
                                ${vocabularyCount}
                                Wörter
                                ·
                                ${questionCount}
                                Fragen
                            </div>

                            <button
                                class="card-open"
                                data-open-id="${item.id}"
                            >
                                Öffnen →
                            </button>

                        </div>

                    </article>
                `;
            })
            .join("");


    container
        .querySelectorAll("[data-open-id]")
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    openPresentation(
                        button.dataset.openId
                    );
                }
            );
        });


    container
        .querySelectorAll(".presentation-card")
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {
                    openPresentation(
                        card.dataset.id
                    );
                }
            );
        });
}


/* =========================================
   VIEW PRESENTATION
========================================= */

function openPresentation(id) {

    const index =
        presentations.findIndex(
            item => item.id === id
        );

    if (index === -1) return;

    currentPresentationIndex = index;

    renderReader();

    document
        .getElementById("viewModal")
        .classList.remove("hidden");
}


function renderReader() {

    const item =
        presentations[currentPresentationIndex];

    if (!item) return;


    document.getElementById("readerStatus").textContent =
        item.status;

    document.getElementById("readerStatus").className =
        `status-badge ${
            item.status === "Fertig"
                ? "finished"
                : "progress"
        }`;


    document.getElementById("readerTitle").textContent =
        item.title;


    document.getElementById("readerAuthor").textContent =
        `von ${item.name}`;


    document.getElementById("readerText").textContent =
        item.text;


    renderVocabulary(item.vocabulary);
    renderQuestions(item.questions);


    document.getElementById("previousBtn").disabled =
        currentPresentationIndex <= 0;


    document.getElementById("nextBtn").disabled =
        currentPresentationIndex >=
        presentations.length - 1;
}


function renderVocabulary(value) {

    const section =
        document.getElementById(
            "readerVocabularySection"
        );

    const container =
        document.getElementById(
            "readerVocabulary"
        );

    const items =
        splitLines(value);


    if (!items.length) {
        section.classList.add("hidden");
        return;
    }

    section.classList.remove("hidden");


    container.innerHTML =
        items
            .map(item =>
                `<span class="tag">${escapeHtml(item)}</span>`
            )
            .join("");
}


function renderQuestions(value) {

    const section =
        document.getElementById(
            "readerQuestionsSection"
        );

    const container =
        document.getElementById(
            "readerQuestions"
        );

    const items =
        splitLines(value);


    if (!items.length) {
        section.classList.add("hidden");
        return;
    }

    section.classList.remove("hidden");


    container.innerHTML =
        items
            .map(item =>
                `<div class="question">${escapeHtml(item)}</div>`
            )
            .join("");
}


/* =========================================
   ADD / EDIT
========================================= */

function openAddModal() {

    resetForm();

    document.getElementById("formEyebrow").textContent =
        "NEUE PRÄSENTATION";

    document.getElementById("formTitle").textContent =
        "Thema hinzufügen";

    document.getElementById("savePresentationBtn").textContent =
        "Speichern";

    document
        .getElementById("editModal")
        .classList.remove("hidden");
}


function openEditModal() {

    const item =
        presentations[currentPresentationIndex];

    if (!item) return;


    document.getElementById("presentationId").value =
        item.id;

    document.getElementById("nameInput").value =
        item.name || "";

    document.getElementById("titleInput").value =
        item.title || "";

    document.getElementById("textInput").value =
        item.text || "";

    document.getElementById("vocabularyInput").value =
        item.vocabulary || "";

    document.getElementById("questionsInput").value =
        item.questions || "";


    const statusRadio =
        document.querySelector(
            `input[name="status"][value="${CSS.escape(item.status)}"]`
        );

    if (statusRadio) {
        statusRadio.checked = true;
    }


    document.getElementById("formEyebrow").textContent =
        "PRÄSENTATION BEARBEITEN";

    document.getElementById("formTitle").textContent =
        "Thema bearbeiten";

    document.getElementById("savePresentationBtn").textContent =
        "Änderungen speichern";


    closeModal("viewModal");

    document
        .getElementById("editModal")
        .classList.remove("hidden");
}


function resetForm() {

    document
        .getElementById("presentationForm")
        .reset();

    document.getElementById("presentationId").value =
        "";

    document.querySelector(
        'input[name="status"][value="Fertig"]'
    ).checked = true;
}


async function savePresentation(event) {

    event.preventDefault();


    if (!supabaseClient) {
        showToast("Supabase ist nicht verbunden.");
        return;
    }


    const id =
        document
            .getElementById("presentationId")
            .value
            .trim();


    const name =
        document
            .getElementById("nameInput")
            .value
            .trim();


    const title =
        document
            .getElementById("titleInput")
            .value
            .trim();


    const text =
        document
            .getElementById("textInput")
            .value
            .trim();


    const vocabulary =
        document
            .getElementById("vocabularyInput")
            .value
            .trim();


    const questions =
        document
            .getElementById("questionsInput")
            .value
            .trim();


    const status =
        document
            .querySelector(
                'input[name="status"]:checked'
            )
            .value;


    if (!name || !title || !text) {
        showToast(
            "Bitte Teilnehmer, Thema und Präsentation ausfüllen."
        );

        return;
    }


    const button =
        document.getElementById(
            "savePresentationBtn"
        );

    button.disabled = true;

    button.textContent = "Speichern...";


    try {

        let error;


        if (id) {

            const result =
                await supabaseClient
                    .from("presentations")
                    .update({
                        name,
                        title,
                        text,
                        vocabulary,
                        questions,
                        status
                    })
                    .eq("id", id);

            error = result.error;

        } else {

            const result =
                await supabaseClient
                    .from("presentations")
                    .insert({
                        name,
                        title,
                        text,
                        vocabulary,
                        questions,
                        status
                    });

            error = result.error;
        }


        if (error) {
            throw error;
        }


        closeModal("editModal");

        await loadPresentations();

        showToast(
            id
                ? "Präsentation wurde aktualisiert."
                : "Präsentation wurde hinzugefügt."
        );


    } catch (error) {

        console.error(error);

        showToast(
            "Speichern fehlgeschlagen."
        );

    } finally {

        button.disabled = false;

        button.textContent =
            id
                ? "Änderungen speichern"
                : "Speichern";
    }
}


/* =========================================
   DELETE
========================================= */

async function deleteCurrentPresentation() {

    const item =
        presentations[currentPresentationIndex];

    if (!item) return;


    const confirmed =
        confirm(
            `Möchtest du die Präsentation "${item.title}" wirklich löschen?`
        );


    if (!confirmed) return;


    try {

        const {
            error
        } = await supabaseClient
            .from("presentations")
            .delete()
            .eq("id", item.id);


        if (error) {
            throw error;
        }


        closeModal("viewModal");

        await loadPresentations();

        showToast(
            "Präsentation wurde gelöscht."
        );


    } catch (error) {

        console.error(error);

        showToast(
            "Löschen fehlgeschlagen."
        );
    }
}


/* =========================================
   RANDOM
========================================= */

function openRandomPresentation() {

    if (!presentations.length) {
        showToast(
            "Es gibt noch keine Präsentationen."
        );

        return;
    }


    const index =
        Math.floor(
            Math.random() *
            presentations.length
        );


    openPresentation(
        presentations[index].id
    );
}


/* =========================================
   NAVIGATION
========================================= */

function scrollToSection(id) {

    const element =
        document.getElementById(id);

    if (!element) return;

    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* =========================================
   TIMER
========================================= */

function openTimer() {

    document
        .getElementById("timerOverlay")
        .classList.remove("hidden");

    resetTimer();
}


function closeTimer() {

    stopTimer();

    document
        .getElementById("timerOverlay")
        .classList.add("hidden");
}


function startTimer() {

    if (timerRunning) {
        stopTimer();
        return;
    }


    if (timerSeconds <= 0) {
        timerSeconds = 180;
    }


    timerRunning = true;

    document.getElementById("timerStartBtn").textContent =
        "Pause";


    timerInterval =
        setInterval(() => {

            timerSeconds--;

            updateTimerDisplay();


            if (timerSeconds <= 0) {

                stopTimer();

                showToast(
                    "3 Minuten sind vorbei."
                );
            }

        }, 1000);
}


function stopTimer() {

    timerRunning = false;

    clearInterval(timerInterval);

    timerInterval = null;

    document.getElementById("timerStartBtn").textContent =
        "Start";
}


function resetTimer() {

    stopTimer();

    timerSeconds = 180;

    updateTimerDisplay();
}


function updateTimerDisplay() {

    const minutes =
        Math.floor(
            timerSeconds / 60
        );

    const seconds =
        timerSeconds % 60;


    document.getElementById("timerDisplay").textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


/* =========================================
   MODALS
========================================= */

function closeModal(id) {

    document
        .getElementById(id)
        .classList.add("hidden");
}


function closeAllModals() {

    closeModal("viewModal");
    closeModal("editModal");
    closeTimer();
}


/* =========================================
   EVENTS
========================================= */

function setupEvents() {

    document
        .getElementById("addBtn")
        .addEventListener(
            "click",
            openAddModal
        );


    document
        .getElementById("emptyAddBtn")
        .addEventListener(
            "click",
            openAddModal
        );


    document
        .getElementById("randomBtn")
        .addEventListener(
            "click",
            openRandomPresentation
        );


    document
        .getElementById("heroRandomBtn")
        .addEventListener(
            "click",
            openRandomPresentation
        );


    document
        .getElementById("startLearningBtn")
        .addEventListener(
            "click",
            () => scrollToSection("presentations")
        );


    document
        .getElementById("logoHome")
        .addEventListener(
            "click",
            event => {

                event.preventDefault();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );


    document
        .querySelectorAll("[data-scroll]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    scrollToSection(
                        button.dataset.scroll
                    );
                }
            );
        });


    document
        .querySelectorAll("[data-close]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.close
                    );
                }
            );
        });


    document
        .getElementById("searchInput")
        .addEventListener(
            "input",
            renderPresentations
        );


    document
        .querySelectorAll(".filter-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentFilter =
                        button.dataset.filter;


                    document
                        .querySelectorAll(".filter-btn")
                        .forEach(item =>
                            item.classList.remove("active")
                        );


                    button.classList.add("active");

                    renderPresentations();
                }
            );
        });


    document
        .getElementById("presentationForm")
        .addEventListener(
            "submit",
            savePresentation
        );


    document
        .getElementById("editPresentationBtn")
        .addEventListener(
            "click",
            openEditModal
        );


    document
        .getElementById("deletePresentationBtn")
        .addEventListener(
            "click",
            deleteCurrentPresentation
        );


    document
        .getElementById("previousBtn")
        .addEventListener(
            "click",
            () => {

                if (currentPresentationIndex <= 0)
                    return;

                currentPresentationIndex--;

                renderReader();
            }
        );


    document
        .getElementById("nextBtn")
        .addEventListener(
            "click",
            () => {

                if (
                    currentPresentationIndex >=
                    presentations.length - 1
                ) {
                    return;
                }

                currentPresentationIndex++;

                renderReader();
            }
        );


    document
        .getElementById("practiceBtn")
        .addEventListener(
            "click",
            openTimer
        );


    document
        .getElementById("closeTimerBtn")
        .addEventListener(
            "click",
            closeTimer
        );


    document
        .getElementById("timerStartBtn")
        .addEventListener(
            "click",
            startTimer
        );


    document
        .getElementById("timerResetBtn")
        .addEventListener(
            "click",
            resetTimer
        );


    document
        .getElementById("viewModal")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target.id === "viewModal"
                ) {
                    closeModal("viewModal");
                }
            }
        );


    document
        .getElementById("editModal")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target.id === "editModal"
                ) {
                    closeModal("editModal");
                }
            }
        );


    document
        .getElementById("timerOverlay")
        .addEventListener(
            "click",
            event => {

                if (
                    event.target.id === "timerOverlay"
                ) {
                    closeTimer();
                }
            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "/" &&
                document.activeElement.tagName !== "INPUT" &&
                document.activeElement.tagName !== "TEXTAREA"
            ) {

                event.preventDefault();

                document
                    .getElementById("searchInput")
                    .focus();
            }


            if (event.key === "Escape") {
                closeAllModals();
            }
        }
    );
}


/* =========================================
   HELPERS
========================================= */

function splitLines(value) {

    if (!value) return [];

    return value
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
}


function getInitials(name) {

    if (!name) return "?";

    const parts =
        name.trim().split(/\s+/);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


let toastTimeout = null;

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.remove("hidden");


    clearTimeout(toastTimeout);


    toastTimeout =
        setTimeout(() => {

            toast.classList.add("hidden");

        }, 3500);
}


/* =========================================
   START
========================================= */

init();