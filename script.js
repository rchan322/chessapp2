const apiKey = process.env.GATSBY_API_KEY;

async function encodeImage(imagePath) {
    updateStep(2);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            console.log('Encoded Image:', reader.result.split(',')[1]);
            resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imagePath);
    });
}

async function getPGNData(imagePath) {
    try {
        const encodedImage = await encodeImage(imagePath);
        const imageUrl = `data:image/jpeg;base64,${encodedImage}`;
        updateStep(3);

        const prompt = [
            { type: 'text', text: 'Return only the PGN moves from this handwritten chess notation sheet. Do not include headers or results. Transcribe the handwriting as-is without using chess logic. Return "Error: Invalid Image format" if PGN can not be derived' },
            { type: 'image_url', image_url: { url: imageUrl } }
        ];

        console.log('Prompt Length:', JSON.stringify(prompt).length);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500
            })
        });

        updateStep(4);

        const responseText = await response.text();
        console.log('API Response:', responseText);

        try {
            const data = JSON.parse(responseText);
            if (data.choices && data.choices.length > 0) {
                let textContent = data.choices[0].message.content.trim();
                console.log('PGN Text:', textContent);
                return textContent;
            } else {
                throw new Error('No valid response from API.');
            }
        } catch (e) {
            console.log('Response is not JSON, returning plain text response.');
            return responseText.trim();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while processing the image. Please try again.');
        throw error;
    }
}

function convertPGNData(pgnText) {
    return pgnText.split('\n').map(line => line.trim()).join('\n');
}

function updateStep(step) {
    const steps = document.querySelectorAll('.steps li');
    steps.forEach((li, index) => {
        if (index < step - 1) {
            li.classList.add('completed');
            li.classList.remove('active');
        } else if (index === step - 1) {
            li.classList.add('active');
            li.classList.remove('completed');
        } else {
            li.classList.remove('active', 'completed');
        }
    });

    if (step === 5) {
        document.querySelector('.steps').style.display = 'none';
        document.getElementById('complete').style.display = 'block';
        document.getElementById('copyText').style.display = 'block';  // Show the "Copy Text" button
    }
}

function resetSteps() {
    const steps = document.querySelectorAll('.steps li');
    steps.forEach((li) => {
        li.classList.remove('completed', 'active');
    });
    document.querySelector('.steps').style.display = 'block';
    document.getElementById('complete').style.display = 'none';
    document.getElementById('copyText').style.display = 'none';  // Hide the "Copy Text" button
}


document.getElementById('upload').addEventListener('change', () => {
    const submitButton = document.getElementById('submit');
    const fileInput = document.getElementById('upload');
    if (fileInput.files.length > 0) {
        document.getElementById('output').innerHTML = '';
        document.getElementById('complete').style.display = 'none';
        document.getElementById('loading').style.display = 'none';
        submitButton.disabled = false;  // Re-enable the submit button when a new file is selected
        resetSteps();
    }
});

document.getElementById('submit').addEventListener('click', async () => {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];
    const submitButton = document.getElementById('submit');
    const loadingMessage = document.getElementById('loading');
    const completeMessage = document.getElementById('complete');
    const outputDiv = document.getElementById('output');

    if (file) {
        updateStep(1);
        submitButton.disabled = true;  // Disable the submit button when processing starts
        loadingMessage.style.display = 'block';
        completeMessage.style.display = 'none';
        const timeout = setTimeout(() => {
            alert('The process is taking too long and has timed out. Please try again later.');
            submitButton.disabled = false;  // Re-enable the button in case of timeout
            loadingMessage.style.display = 'none';
            resetSteps();
            outputDiv.innerHTML = 'Error: Invalid Image Format';
        }, 60000);

        try {
            const pgnText = await getPGNData(file);
            clearTimeout(timeout);
            console.log('PGN Data after API call:', pgnText);

            updateStep(5);
            if (pgnText !== 'Error: Invalid Image Format') {
                const pgnString = convertPGNData(pgnText);
                completeMessage.style.display = 'block';
                outputDiv.innerHTML = `<pre>${pgnString}</pre>`;
            } else {
                outputDiv.innerHTML = `<pre>${pgnText}</pre>`;
            }
            submitButton.disabled = true;  // Keep the button disabled after processing
        } catch (error) {
            clearTimeout(timeout);
            outputDiv.innerHTML = 'Error: Invalid Image Format';
        } finally {
            loadingMessage.style.display = 'none';
        }
    } else {
        alert('Please select a file first.');
    }
});

document.getElementById('copyText').addEventListener('click', () => {
    const text = document.getElementById('output').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Text copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy text: ', err);
    });
});
