  const dropzone = document.getElementById('dropzone');
  const dzEmpty = document.getElementById('dzEmpty');
  const dzImageWrap = document.getElementById('dzImageWrap');
  const fileInput = document.getElementById('fileInput');
  const previewImg = document.getElementById('previewImg');
  const replaceBtn = document.getElementById('replaceBtn');
  const generateBtn = document.getElementById('generateBtn');
  const generateLabel = document.getElementById('generateLabel');
  const errorBanner = document.getElementById('errorBanner');
  const placeholderState = document.getElementById('placeholderState');
  const filledState = document.getElementById('filledState');
  const altValue = document.getElementById('altValue');
  const charCount = document.getElementById('charCount');
  const copyBtn = document.getElementById('copyBtn');
  const regenBtn = document.getElementById('regenBtn');
  const statusLabel = document.getElementById('statusLabel');
  const contextInput = document.getElementById('contextInput');
  const lenButtons = document.querySelectorAll('.opt-group button');

  let currentBase64 = null;
  let currentMediaType = null;
  let currentLength = 'concise';

  lenButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      lenButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLength = btn.dataset.len;
    });
  });

  function openFileDialog(){ fileInput.click(); }
  dropzone.addEventListener('click', (e) => {
    if (dzImageWrap.classList.contains('active')) return;
    openFileDialog();
  });
  dropzone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !dzImageWrap.classList.contains('active')) {
      e.preventDefault();
      openFileDialog();
    }
  });
  replaceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFileDialog();
  });

  ['dragover','dragenter'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave','drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file){
    if (!file.type.startsWith('image/')){
      showError('That file doesn\'t look like an image. Try a JPG, PNG, or WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024){
      showError('That image is over 10MB. Try a smaller file.');
      return;
    }
    hideError();
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      currentMediaType = file.type;
      currentBase64 = result.split(',')[1];
      previewImg.src = result;
      dzEmpty.style.display = 'none';
      dzImageWrap.classList.add('active');
      generateBtn.disabled = false;
      generateLabel.textContent = 'Generate alt text';
      resetOutput();
    };
    reader.readAsDataURL(file);
  }

  function resetOutput(){
    placeholderState.style.display = 'flex';
    filledState.style.display = 'none';
    copyBtn.disabled = true;
    regenBtn.disabled = true;
    charCount.textContent = '';
    statusLabel.textContent = '';
  }

  function showError(msg){
    errorBanner.textContent = msg;
    errorBanner.classList.add('show');
  }
  function hideError(){
    errorBanner.classList.remove('show');
  }

  function lengthInstruction(len){
    if (len === 'concise') return 'Write CONCISE alt text: a single short sentence, ideally under 125 characters, capturing only the essential subject and action.';
    if (len === 'descriptive') return 'Write DESCRIPTIVE alt text: one to two sentences, up to roughly 250 characters, covering the subject, relevant details, and composition where it matters.';
    if (len === 'decorative') return 'This image has been marked as purely decorative. Respond with exactly: DECORATIVE (nothing else).';
    return '';
  }

  async function generate(){
    if (!currentBase64) return;
    hideError();
    dropzone.classList.add('scanning');
    generateBtn.disabled = true;
    regenBtn.disabled = true;
    copyBtn.disabled = true;
    generateLabel.textContent = 'Reading image…';
    statusLabel.textContent = 'scanning…';
    placeholderState.style.display = 'flex';
    placeholderState.textContent = 'Reading the image…';
    filledState.style.display = 'none';

    const contextNote = contextInput.value.trim();
    const systemPrompt = `You write alt text for images on the web, following WCAG guidance. Rules:
- Describe what is actually depicted: subject, action, and relevant detail. Never start with "image of", "picture of", or "photo of".
- Never invent details you can't see, and don't editorialize about mood or quality.
- If there is legible text in the image that carries meaning (a sign, a slide, a quote), include it briefly.
- Output ONLY the alt text itself: no quotation marks, no preamble, no explanation.
${lengthInstruction(currentLength)}`;

    const userText = contextNote
      ? `Context for this image: ${contextNote}`
      : `Write the alt text for this image.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: currentMediaType, data: currentBase64 } },
                { type: "text", text: userText }
              ]
            }
          ]
        })
      });

      if (!response.ok){
        throw new Error('Request failed with status ' + response.status);
      }

      const data = await response.json();
      const textBlock = data.content.find(b => b.type === 'text');
      let text = textBlock ? textBlock.text.trim() : '';
      text = text.replace(/^["“]|["”]$/g, '').trim();

      if (text.toUpperCase() === 'DECORATIVE'){
        text = '';
        renderOutput(text, true);
      } else {
        renderOutput(text, false);
      }
      statusLabel.textContent = 'done';
    } catch (err){
      console.error('Alt text generation error:', err);
      showError('Something went wrong generating alt text. Try again in a moment.');
      statusLabel.textContent = '';
      placeholderState.style.display = 'flex';
      placeholderState.textContent = 'Your alt attribute will appear here once you generate it.';
      filledState.style.display = 'none';
    } finally {
      dropzone.classList.remove('scanning');
      generateBtn.disabled = false;
      generateLabel.textContent = 'Regenerate alt text';
      regenBtn.disabled = false;
    }
  }

  function renderOutput(text, isDecorative){
    placeholderState.style.display = 'none';
    filledState.style.display = 'flex';
    altValue.value = isDecorative ? '' : text;
    altValue.placeholder = isDecorative ? '(empty — marked decorative)' : '';
    updateCharCount();
    copyBtn.disabled = false;
  }

  function updateCharCount(){
    const len = altValue.value.length;
    charCount.textContent = len + ' characters';
    charCount.classList.toggle('warn', currentLength === 'concise' && len > 125);
  }

  altValue.addEventListener('input', updateCharCount);

  generateBtn.addEventListener('click', generate);
  regenBtn.addEventListener('click', generate);

  copyBtn.addEventListener('click', async () => {
    const val = altValue.value;
    try {
      await navigator.clipboard.writeText('alt="' + val + '"');
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy alt="…"';
        copyBtn.classList.remove('copied');
      }, 1600);
    } catch (e){
      showError('Couldn\'t copy automatically — select the text and copy manually.');
    }
  });
