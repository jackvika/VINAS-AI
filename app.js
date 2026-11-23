async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // Plain http on a LAN or free host has no clipboard API.
    const box = document.createElement('textarea');
    box.value = text;
    box.className = 'sr';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    if (!ok) throw new Error('copy failed');
}

function saveFile(blob, name) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const input = document.getElementById('text');

// One listener, so buttons added later by static/site.js work too.
document.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { copy, download, reuse, print } = button.dataset;
    if (copy) {
        const label = button.textContent;
        button.disabled = true;
        try {
            await copyText(document.getElementById(copy).value);
            button.textContent = 'Copied';
        } catch {
            button.textContent = 'Copy failed';
        }
        setTimeout(() => {
            button.textContent = label;
            button.disabled = false;
        }, 1800);
    } else if (download) {
        saveFile(new Blob([document.getElementById(download).value], { type: 'text/plain;charset=utf-8' }), button.dataset.name);
    } else if (reuse) {
        input.value = document.getElementById(reuse).value;
        input.dispatchEvent(new Event('input'));
        input.scrollIntoView({ block: 'center' });
        input.focus();
    } else if (print !== undefined) {
        window.print();
    }
});

const counter = document.getElementById('count');
if (input && counter) {
    const update = () => {
        const words = input.value.trim().split(/\s+/).filter(Boolean).length;
        counter.textContent = `${words} words, ${input.value.length} of ${input.maxLength} characters`;
    };
    input.addEventListener('input', update);
    update();
}

// Open the pattern a link points at.
function openTarget() {
    const target = /^#p\d+$/.test(location.hash) && document.querySelector(location.hash);
    if (target) {
        target.open = true;
        target.scrollIntoView();
    }
}
window.addEventListener('hashchange', openTarget);
openTarget();
