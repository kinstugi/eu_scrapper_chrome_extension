const NAMESPACE = 'tradecomplyScraper';
const ALL_SECTIONS_VALUE = '__all__';

document.addEventListener('DOMContentLoaded', () => {
    const ui = {
        countrySelect: document.getElementById('countrySelect'),
        sectionSelect: document.getElementById('sectionSelect'),
        startButton: document.getElementById('startButton'),
        resumeButton: document.getElementById('resumeButton'),
        clearButton: document.getElementById('clearButton'),
        statusSummary: document.getElementById('statusSummary'),
        statusDetails: document.getElementById('statusDetails'),
        feedback: document.getElementById('feedback')
    };

    const statusCtx = { value: null };
    let activeTabId = null;

    chrome.runtime.onMessage.addListener((message) => {
        if (!message || message.namespace !== NAMESPACE || !message.payload) {
            return;
        }
        statusCtx.value = message.payload;
        updateStatusUI(ui, statusCtx.value);
    });

    ui.countrySelect.addEventListener('change', () => handleCountryChange(ui, activeTabId, statusCtx));
    ui.startButton.addEventListener('click', () => handleStart(ui, activeTabId, statusCtx));
    ui.resumeButton.addEventListener('click', () => handleResume(ui, activeTabId, statusCtx));
    ui.clearButton.addEventListener('click', () => handleClear(ui, activeTabId, statusCtx, () => populateSections(ui, activeTabId, statusCtx)));

    (async () => {
        try {
            activeTabId = await getActiveTabId();
            if (!activeTabId) {
                throw new Error('No active tab detected.');
            }
            await ensureContentScript(activeTabId);
            await refreshStatus(ui, activeTabId, statusCtx);
            await populateCountries(ui, activeTabId, statusCtx);
            await populateSections(ui, activeTabId, statusCtx);
            await refreshStatus(ui, activeTabId, statusCtx);
        } catch (err) {
            showFeedback(ui, err.message || 'Failed to initialise.');
            disableControls(ui, true);
        }
    })();
});

async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0]?.id ?? null;
}

async function ensureContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
    } catch (err) {
        const message = err?.message || '';
        if (!/Cannot access contents of url/i.test(message)) {
            console.warn('[TradeComply] Unable to inject content script:', err);
        }
        throw err;
    }
}

async function sendCommand(tabId, type, options = {}) {
    if (!tabId) {
        throw new Error('No active tab available.');
    }

    const payload = { namespace: NAMESPACE, type, options };

    try {
        return await chrome.tabs.sendMessage(tabId, payload);
    } catch (err) {
        if (err?.message?.includes('Receiving end does not exist')) {
            await ensureContentScript(tabId);
            return chrome.tabs.sendMessage(tabId, payload);
        }
        throw err;
    }
}

async function populateSections(ui, tabId, statusCtx) {
    try {
        const response = await sendCommand(tabId, 'getSections');
        if (!response?.ok) {
            throw new Error(response?.error || 'Unable to load sections.');
        }
        renderSectionOptions(ui.sectionSelect, response.sections || [], statusCtx.value);
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to load sections.');
        renderSectionOptions(ui.sectionSelect, [], statusCtx.value);
    }
}

async function populateCountries(ui, tabId, statusCtx) {
    try {
        const response = await sendCommand(tabId, 'getCountries');
        if (!response?.ok) {
            throw new Error(response?.error || 'Unable to read country list.');
        }
        if (!statusCtx.value) {
            statusCtx.value = {};
        }
        const countries = response.countries || [];
        const code = response.selected || statusCtx.value?.country?.code || '';
        const matchedCountry = countries.find((country) => country.value === code);
        statusCtx.value.country = {
            code,
            label: response.label || matchedCountry?.label || statusCtx.value?.country?.label || code
        };
        renderCountryOptions(ui.countrySelect, countries, statusCtx.value);
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to read country list.');
        renderCountryOptions(ui.countrySelect, [], statusCtx.value);
    }
}

function renderSectionOptions(selectEl, sections, status) {
    selectEl.innerHTML = '';
    const defaultOption = new Option('All sections', ALL_SECTIONS_VALUE);
    selectEl.appendChild(defaultOption);

    sections.forEach((section) => {
        const option = new Option(
            `${section.label} — ${section.name}`,
            section.key
        );
        selectEl.appendChild(option);
    });

    const desired = status?.desiredSectionKeys;
    if (desired && desired.length === 1 && sections.some((section) => section.key === desired[0])) {
        selectEl.value = desired[0];
    } else {
        selectEl.value = ALL_SECTIONS_VALUE;
    }
}

function renderCountryOptions(selectEl, countries, status) {
    const previousValue = selectEl.value;
    selectEl.innerHTML = '';

    const placeholder = new Option('Select on page…', '');
    placeholder.disabled = true;
    placeholder.selected = true;
    selectEl.appendChild(placeholder);

    countries.forEach((country) => {
        const option = new Option(country.label || country.value, country.value);
        selectEl.appendChild(option);
    });

    const desired = status?.country?.code;
    if (desired) {
        const option = Array.from(selectEl.options).find((opt) => opt.value === desired);
        if (option) {
            option.selected = true;
            option.disabled = false;
            placeholder.selected = false;
        }
    } else if (previousValue && Array.from(selectEl.options).some((opt) => opt.value === previousValue)) {
        selectEl.value = previousValue;
        placeholder.selected = false;
    }

    if (selectEl.selectedIndex <= 0 && selectEl.options.length > 1) {
        placeholder.text = 'Pick destination country';
        placeholder.disabled = true;
    } else if (selectEl.selectedIndex > 0) {
        placeholder.disabled = true;
    }
}

async function refreshStatus(ui, tabId, statusCtx) {
    try {
        const response = await sendCommand(tabId, 'getStatus');
        if (response?.ok) {
            statusCtx.value = response.status;
            updateStatusUI(ui, response.status);
        }
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to read status.');
    }
}

async function handleStart(ui, tabId, statusCtx) {
    clearFeedback(ui);
    if (!ui.countrySelect.value) {
        showFeedback(ui, 'Select a destination country on the page before starting.');
        return;
    }
    ui.startButton.disabled = true;
    try {
        const sectionKey = ui.sectionSelect.value || ALL_SECTIONS_VALUE;
        const response = await sendCommand(tabId, 'start', { sectionKey, restart: true });
        if (!response?.ok) {
            throw new Error(response?.error || 'Unable to start scraping.');
        }
        await refreshStatus(ui, tabId, statusCtx);
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to start scraping.');
    } finally {
        updateStatusUI(ui, statusCtx.value);
    }
}

async function handleResume(ui, tabId, statusCtx) {
    clearFeedback(ui);
    ui.resumeButton.disabled = true;
    try {
        const response = await sendCommand(tabId, 'resume');
        if (!response?.ok) {
            throw new Error(response?.error || 'Unable to resume.');
        }
        await refreshStatus(ui, tabId, statusCtx);
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to resume scraping.');
    } finally {
        updateStatusUI(ui, statusCtx.value);
    }
}

async function handleClear(ui, tabId, statusCtx, onAfterClear) {
    clearFeedback(ui);
    ui.clearButton.disabled = true;
    try {
        const response = await sendCommand(tabId, 'clear');
        if (!response?.ok) {
            throw new Error(response?.error || 'Unable to clear saved state.');
        }
        await onAfterClear();
        await refreshStatus(ui, tabId, statusCtx);
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to clear saved state.');
    } finally {
        updateStatusUI(ui, statusCtx.value);
    }
}

function updateStatusUI(ui, status) {
    if (!status) {
        ui.statusSummary.textContent = 'Idle.';
        ui.statusDetails.textContent = 'Choose a section and click Start to begin scraping.';
        ui.startButton.disabled = false;
        ui.resumeButton.disabled = true;
        ui.clearButton.disabled = false;
        ui.sectionSelect.disabled = false;
        ui.countrySelect.disabled = false;
        return;
    }

    let summary;
    if (status.paused) {
        summary = 'Paused — complete verification on the page and press Resume.';
    } else if (status.running) {
        summary = 'Scraping in progress…';
    } else {
        summary = 'Idle.';
    }
    ui.statusSummary.textContent = summary;

    const detailLines = [];
    if (status.country?.code) {
        const label = status.country.label || status.country.code;
        detailLines.push(`Country: ${label} (${status.country.code})`);
    }
    if (status.currentSection) {
        detailLines.push(`${status.currentSection.label}: ${status.currentSection.processed} processed · ${status.currentSection.remaining} remaining`);
    }
    if (status.completedSections && status.completedSections.length) {
        const total = status.totalSections || status.completedSections.length;
        detailLines.push(`Completed sections: ${status.completedSections.length}/${total}`);
    }
    if (status.pauseReason && status.paused) {
        detailLines.push(status.pauseReason);
    }
    if (!detailLines.length) {
        detailLines.push('Ready to start scraping section data.');
    }
    ui.statusDetails.textContent = detailLines.join('\n');

    ui.startButton.disabled = Boolean(status.running);
    ui.resumeButton.disabled = !status.paused;
    ui.clearButton.disabled = Boolean(status.running);
    ui.sectionSelect.disabled = Boolean(status.running);
    ui.countrySelect.disabled = Boolean(status.running);

    const desired = status.desiredSectionKeys;
    if (desired && desired.length === 1) {
        const option = Array.from(ui.sectionSelect.options).find((opt) => opt.value === desired[0]);
        if (option) {
            ui.sectionSelect.value = desired[0];
        }
    } else if (!ui.sectionSelect.value) {
        ui.sectionSelect.value = ALL_SECTIONS_VALUE;
    }

    if (status.country?.code) {
        const code = status.country.code;
        const option = Array.from(ui.countrySelect.options).find((opt) => opt.value === code);
        if (option) {
            ui.countrySelect.value = code;
        }
    }
}

function showFeedback(ui, message) {
    ui.feedback.textContent = message || '';
}

function clearFeedback(ui) {
    ui.feedback.textContent = '';
}

function disableControls(ui, disabled) {
    ui.startButton.disabled = disabled;
    ui.resumeButton.disabled = disabled;
    ui.clearButton.disabled = disabled;
    ui.sectionSelect.disabled = disabled;
    ui.countrySelect.disabled = disabled;
}

async function handleCountryChange(ui, tabId, statusCtx) {
    clearFeedback(ui);
    const selectedValue = ui.countrySelect.value;
    if (!selectedValue) {
        return;
    }
    ui.countrySelect.disabled = true;
    try {
        const selectedOption = ui.countrySelect.selectedIndex >= 0 ? ui.countrySelect.options[ui.countrySelect.selectedIndex] : null;
        const label = selectedOption ? selectedOption.textContent : '';
        const response = await sendCommand(tabId, 'setCountry', { countryCode: selectedValue, label });
        if (!response?.ok) {
            throw new Error(response?.error || 'Unable to update country.');
        }
        if (!statusCtx.value) {
            statusCtx.value = {};
        }
        statusCtx.value.country = response.country || {
            code: selectedValue,
            label
        };
        await populateSections(ui, tabId, statusCtx);
        await refreshStatus(ui, tabId, statusCtx);
    } catch (err) {
        showFeedback(ui, err.message || 'Unable to update country.');
    } finally {
        updateStatusUI(ui, statusCtx.value);
    }
}