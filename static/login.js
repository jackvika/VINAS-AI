// Sends the password once. The server answers with a cookie that scripts cannot read.
document.getElementById('login').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    const wrong = document.getElementById('wrong');
    button.disabled = true;
    wrong.textContent = '';
    try {
        const r = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('password').value }),
        });
        if (r.ok) {
            if (location.pathname === '/login.html') location.replace('/');
            else location.reload();
            return;
        }
        wrong.textContent = (await r.json()).error || 'That did not work.';
    } catch {
        wrong.textContent = 'The server could not be reached.';
    }
    button.disabled = false;
});
