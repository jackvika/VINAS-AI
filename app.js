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

document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.textContent;
    button.addEventListener('click', async () => {
        try {
            await copyText(document.getElementById(button.dataset.copy).value);
            button.textContent = 'Copied';
        } catch {
            button.textContent = 'Copy failed';
        }
        setTimeout(() => { button.textContent = label; }, 1800);
    });
});

document.querySelectorAll('[data-download]').forEach((button) => {
    button.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([document.getElementById(button.dataset.download).value], { type: 'text/plain;charset=utf-8' }));
        link.download = button.dataset.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
});

document.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => window.print());
});

const input = document.getElementById('text');

document.querySelectorAll('[data-reuse]').forEach((button) => {
    button.addEventListener('click', () => {
        input.value = document.getElementById(button.dataset.reuse).value;
        input.dispatchEvent(new Event('input'));
        input.scrollIntoView({ block: 'center' });
        input.focus();
    });
});

const count = document.getElementById('count');
if (input && count) {
    const update = () => {
        const words = input.value.trim().split(/\s+/).filter(Boolean).length;
        count.textContent = `${words} words, ${input.value.length} of ${input.maxLength} characters`;
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
