// ----------------- SETUP ----------------- //


// state variables
let recognition = null;
let scriptModifyingDOM = false;
let mainFunctionRunning = false;
let isRecognitionActive = false;
let toggleRecognitionFunction = null;

// add event listeners
window.addEventListener('resize', runMain);
window.addEventListener('keydown', handleHotkey);

// check if screen width is valid
function isScreenSizeValid() {
    return window.innerWidth >= 1100;
}

// run main function
async function runMain() {
    if (isScreenSizeValid() && !mainFunctionRunning) {
        mainFunctionRunning = true;
        main();
    } else if (!isScreenSizeValid() && mainFunctionRunning) {
        mainFunctionRunning = false;
        removeMain();
    }
    const snippetsData = await fetchSnippetsData();
    console.log('snippetsData', snippetsData);
}


// ----------------- MAIN FUNCTION ----------------- //


async function main() {
    // select chatbox element
    const chatboxElement = document.querySelector('textarea[tabindex="0"]');

    // check if chatbox element exists
    if (!chatboxElement) {
        console.warn('Could not find chatbox element.');
        return;
    }

    // select chatbox parent element and send button
    const chatboxParentElement = chatboxElement.parentNode;
    const sendButton = chatboxParentElement.querySelector('button:nth-child(2)');

    // create necessary elements
    const microphoneButton = document.createElement('button');
    const iconContainer = document.createElement('div');
    const microphoneSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const microphonePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const microphoneAnimation = document.createElement('style');


    // ----------------- SPEECH RECOGNITION ----------------- //


    // check if browser supports Speech Recognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Speech Recognition API is not supported in this browser.');
        return;
    }

    // create an instance of Speech Recognition API
    if (!recognition) {
        recognition = new SpeechRecognition();
    }

    // speech recognition settings
    recognition.continuous = true;
    recognition.interimResults = true;

    // if speech recognition times-out but is supposed to still be active, restart it
    recognition.onend = () => {
        if (isRecognitionActive) {
            setTimeout(() => recognition.start(), 100);
        }
    };


    // ----------------- CREATE BUTTON ----------------- //


    if (chatboxParentElement) {
        // start modifying DOM
        scriptModifyingDOM = true;

        // build microphone button
        microphoneButton.setAttribute('class', 'GPT-microphone-button absolute border-black/10 bg-white dark:border-gray-900/50 dark:text-white dark:bg-gray-700 rounded-md shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] hover:bg-gray-100 dark:hover:bg-gray-900');
        microphoneButton.setAttribute('style', 'right: -60px; bottom: 0; height: 50px; width: 50px; display: flex; align-items: center; justify-content: center; border-width: 1px; margin-bottom: -1px;');

        // build icon container
        iconContainer.setAttribute('class', 'GPT-microphone-icon');
        iconContainer.setAttribute('style', 'position: relative; width: 21px; height: 21px;');

        // build svg element
        microphoneSVG.setAttribute('class', 'GPT-microphone-svg');
        microphoneSVG.setAttribute('width', '21');
        microphoneSVG.setAttribute('height', '21');
        microphoneSVG.setAttribute('viewBox', '0 0 484.5 484.5');
        microphoneSVG.setAttribute('xml:space', 'preserve');

        // build path element
        microphonePath.setAttribute('class', 'GPT-microphone-path');
        microphonePath.setAttribute('fill', '#8e8ea0');
        microphonePath.setAttribute('d', 'M242.25,306c43.35,0,76.5-33.15,76.5-76.5v-153c0-43.35-33.15-76.5-76.5-76.5c-43.35,0-76.5,33.15-76.5,76.5v153C165.75,272.85,198.9,306,242.25,306z M377.4,229.5c0,76.5-63.75,130.05-135.15,130.05c-71.4,0-135.15-53.55-135.15-130.05H63.75c0,86.7,68.85,158.1,153,170.85v84.15h51v-84.15c84.15-12.75,153-84.149,153-170.85H377.4L377.4,229.5z');

        // build animation
        microphoneAnimation.setAttribute('class', 'GPT-microphone-animation');
        microphoneAnimation.innerHTML = `
        .GPT-microphone-active::before {
            content: "";
            display: block;
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: #f25c54;
            opacity: 0;
            animation: wave 1.65s infinite;
        }
        @keyframes wave {
            0% {
                transform: scale(.5);
                opacity: 0;
            }
            30% {
                opacity: .5;
            }
            100% {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;

        // append everything to DOM
        microphoneSVG.appendChild(microphonePath);
        iconContainer.appendChild(microphoneSVG);
        microphoneButton.appendChild(iconContainer);
        chatboxParentElement.appendChild(microphoneButton);
        document.head.appendChild(microphoneAnimation);


        // ----------------- LISTEN TO EVENTS ----------------- //


        // append transcript to chatbox
        recognition.addEventListener('result', (event) => {
            chatboxElement.focus();
            const lastIndex = event.results.length - 1;
            const previousText = chatboxElement.value.slice(0, chatboxElement.selectionStart);
            const transcript = event.results[lastIndex][0].transcript.trim();
            const processedTranscript = processTranscript(previousText, transcript);
            // if speech recognition is final, insert transcript at cursor position
            if (event.results[lastIndex].isFinal) {
                // get cursor position and selection if any
                const selectionStart = chatboxElement.selectionStart;
                const selectionEnd = chatboxElement.selectionEnd;
                // insert transcript at cursor position
                const value = chatboxElement.value;
                chatboxElement.value = value.slice(0, selectionStart) + processedTranscript + value.slice(selectionEnd);
                // move cursor to end of inserted text
                chatboxElement.selectionStart = selectionStart + processedTranscript.length;
                chatboxElement.selectionEnd = chatboxElement.selectionStart;
                // manually trigger input event
                const inputEvent = new Event('input', { bubbles: true });
                chatboxElement.dispatchEvent(inputEvent);
            }
        });

        // turn off speech recognition on submit
        chatboxElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { // don't turn off if shift + enter
                turnOff(recognition);
                isRecognitionActive = false;
            }
        });

        // toggle speech recognition on click
        microphoneButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleRecognition();
        });

        // stop modifying DOM
        scriptModifyingDOM = false;
    }


    // ----------------- HELPER FUNCTIONS ----------------- //


    // toggle speech recognition
    async function toggleRecognition() {
        const hasMicrophoneAccess = await checkMicrophoneAccess();
        // stop if user has not granted microphone access
        if (!hasMicrophoneAccess) {
            alert("Microphone access not granted. Please allow access to use this feature.");
            return;
        }
        isRecognitionActive ? turnOff(recognition) : turnOn(recognition);
        isRecognitionActive = !isRecognitionActive;
        chatboxElement.focus();
    }

    // turn microphone button on
    function turnOn(recognition) {
        playAudioTone('ON');
        recognition.start();
        microphonePath.setAttribute('fill', '#f25c54');
        iconContainer.classList.add('GPT-microphone-active');
    }

    // turn microphone button off
    async function turnOff(recognition) {
        if (isRecognitionActive) {
            playAudioTone('OFF');
        }
        recognition.stop();
        microphonePath.setAttribute('fill', '#8e8ea0');
        iconContainer.classList.remove('GPT-microphone-active');
        // send message if user has enabled option
        if (await sendMessageOnMicOff()) {
            sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }

    // process voice transcript
    function processTranscript(previousText, text) {
        const punctuationMap = {
            'colon': ':',
            'comma': ',',
            'period': '.',
            'new line': '\n',
            'ellipsis': '...',
            'ellipses': '...',
            'next line': '\n',
            'semicolon': ';',
            'full stop': '.',
            'question mark': '?',
            'exclamation mark': '!',
            'exclamation point': '!',
        };
        // capitalize first word if chatbox is empty or last character is ".", "!", "?", or newline
        if (previousText.length === 0 || /[.!?]$/.test(previousText.trim()) || previousText.slice(-1) === '\n') {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }
        // add a space to start if chatbox is not empty, last character is not a newline, and last character is not a space
        if (previousText.length > 0 && previousText.slice(-1) !== '\n' && previousText.slice(-1) !== ' ') {
            text = ' ' + text;
        }
        // replace any punctuation words with actual punctuation
        const regexPattern = new RegExp(`\\b(${Object.keys(punctuationMap).join('|')})\\b`, 'gi');
        let newText = text.replace(regexPattern, (match, p1) => {
            const punctuation = punctuationMap[p1.toLowerCase()];
            return punctuation ? punctuation : match;
        });
        // capitalize words following ".", "!", "?"
        newText = newText.replace(/([.!?])\s*(\w)/g, (_, p1, p2) => {
            return p1 + ' ' + p2.toUpperCase();
        });
        // remove whitespace before punctuation
        newText = newText.replace(/\s+([,.!?:])/g, '$1');
        return newText;
    }

    // play audio tone
    async function playAudioTone(toneType) {
        if (!await onOffAudioFeedback()) return;
        const userVolume = await onOffAudioVolume();
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        // set on and off tone properties
        const isTurningOn = toneType === 'ON';
        const frequency = isTurningOn ? 400 : 300;
        const duration = isTurningOn ? 0.4 : 0.35;
        const volume = (isTurningOn ? 0.2 : 0.16) * userVolume / 100;
        // set oscillator and gain node properties
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.setTargetAtTime(0.0001, audioContext.currentTime + duration / 2.5, duration / 12);
        // play tone
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    // assign toggleRecognition function to global scope
    toggleRecognitionFunction = toggleRecognition;
}

// ----------------- SIDE EFFECTS ----------------- //


// check microphone access
async function checkMicrophoneAccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // if user grants access, stop stream to release microphone
        stream.getTracks().forEach((track) => track.stop());
        return true;
    } catch (error) {
        return false;
    }
}

// listen for hotkey
function handleHotkey(e) {
    const isMac = navigator.userAgent.includes("Mac");
    const activationKey = isMac ? e.metaKey : e.ctrlKey;
    // if ctrl/cmd + m is pressed, toggle speech recognition
    if (activationKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleRecognitionFunction();
    }
}

// load sendMessageOnMicOff setting from storage
async function sendMessageOnMicOff() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('sendMessageOnMicOff', (result) => {
            return resolve(result.sendMessageOnMicOff);
        });
    });
}

// load onOffAudioFeedback setting from storage
async function onOffAudioFeedback() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('onOffAudioFeedback', (result) => {
            return resolve(result.onOffAudioFeedback);
        });
    });
}

// load onOffAudioVolume setting from storage
async function onOffAudioVolume() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('onOffAudioVolume', (result) => {
            return resolve(result.onOffAudioVolume) || 0;
        });
    });
}

// load snippets data from storage
async function fetchSnippetsData() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('snippetsData', (result) => {
            return resolve(result.snippetsData);
        });
    });
}

// debounce function
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// initialize observer to re-run main() if microphone button is not present
function initObserver() {
    const observer = new MutationObserver(
        debounce((mutations) => {
            for (const mutation of mutations) {
                if (
                    mutation.type === 'childList' &&
                    mutation.addedNodes.length > 0 &&
                    !document.querySelector('.GPT-microphone-button') &&
                    !scriptModifyingDOM
                ) {
                    removeMain();
                    main();
                }
            }
        }, 10)
    );
    observer.observe(document.body, { childList: true, subtree: true });
}

// remove main function
function removeMain() {
    scriptModifyingDOM = true;
    if (recognition) {
        recognition.onend = null;
        recognition.abort();
    }
    isRecognitionActive = false;
    toggleRecognitionFunction = null;
    const microphoneActive = document.querySelector('.GPT-microphone-active');
    const microphonePath = document.querySelector('.GPT-microphone-path');
    const microphoneSVG = document.querySelector('.GPT-microphone-svg');
    const iconContainer = document.querySelector('.GPT-microphone-icon');
    const microphoneButton = document.querySelector('.GPT-microphone-button');
    const microphoneAnimation = document.querySelector('.GPT-microphone-animation');
    if (microphoneActive) microphoneActive.remove();
    if (microphonePath) microphonePath.remove();
    if (microphoneSVG) microphoneSVG.remove();
    if (iconContainer) iconContainer.remove();
    if (microphoneButton) microphoneButton.remove();
    if (microphoneAnimation) microphoneAnimation.remove();
    scriptModifyingDOM = false;
}


runMain();
initObserver();