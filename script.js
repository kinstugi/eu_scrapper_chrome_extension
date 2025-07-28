document.addEventListener('DOMContentLoaded', () => {
    const helloButton = document.getElementById('helloButton');

    helloButton.addEventListener('click', () => {
        // This is the correct way to display "Hello World!" on the *currently active webpage*
        // in a real browser extension.
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        function: injectHelloWorldMessage // This function will be executed as a content script
                    });
                } else {
                    console.error("No active tab found.");
                }
            });
        } else {
            // Fallback for Canvas environment or if Chrome APIs are not available
            console.warn("Chrome Extension APIs not available. Displaying message in popup context.");
            let messageBox = document.getElementById('helloMessageBox');
            if (!messageBox) {
                messageBox = document.createElement('div');
                messageBox.id = 'helloMessageBox';
                messageBox.className = 'message-box';
                document.body.appendChild(messageBox);
            }
            messageBox.textContent = 'Hello World!';
            messageBox.classList.add('show');
            setTimeout(() => {
                messageBox.classList.remove('show');
            }, 3000);
        }
    });
});

// This function will be injected and executed as a content script on the target webpage.


function injectHelloWorldMessage() {
    let url = "https://trade.ec.europa.eu/access-to-markets/api/v2/nomenclature/products?country=DE&lang=EN";
    let description = []
    let results = []


    function randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const recur = async (data, section, sec_name) => {
        if (!data.hasChildren)
        {
            results.push({
                "hs_code": data.code, 
                "description": description.join(', '), 
                "section": section, 
                "section_name": sec_name,
                "chapter": data.code.substring(0, 2),
                "heading": data.code.substring(0, 4),
                "subheading": data.code.substring(4)
            })
            return;
        }
        let res = await fetch(`${url}&parent=${data.id}`)
        if (res.status === 429 || res.status !== 200)
            throw Error()
        let children = await res.json()
        await delay(randomBetween(2000, 5000))
        for (let child of children)
        {
            description.push(child.description)
            await recur(child, section, sec_name)
            description.pop()
        }
    }

    const downloadFile = async (filename, content, mimeType = 'text/plain') => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a); // Append to body to ensure it's in the DOM
        a.click();
        document.body.removeChild(a); // Clean up the temporary element
        URL.revokeObjectURL(url); // Release the object URL
        console.log(`Download initiated for '${filename}'. Check your downloads folder.`);
    }

    fetch(url).then((res)=>{
        if (res.status !== 200)
            throw Error('failed')
        return res.json()
    }).then(async (res)=>{
        for(let data of res)
        {
            await recur(data, data.section.description, data.description).catch((err)=>{
                throw Error()
            })
            break;
        }
    }).then((res)=>{
        downloadFile('data.json', JSON.stringify(results, null, 2), 'application/json')
    }).catch((err)=>{
        console.log(err)
        downloadFile('data.json', JSON.stringify(results, null, 2), 'application/json')
    })
}