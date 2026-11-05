const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function toast(message, isError = false) {
  const box = $('#toast');
  if (!box) return;
  box.textContent = message;
  box.style.background = isError ? '#a83242' : '#173355';
  box.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => box.classList.remove('show'), 3800);
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Something went wrong. Please try again.');
  }
  if (response.status === 204) return null;
  return response.json();
}

$('.menu-button')?.addEventListener('click', () => $('.sidebar')?.classList.toggle('open'));

const content = $('#content');
const count = $('#character-count');
function updateCount() { if (content && count) count.textContent = `${content.value.length.toLocaleString()} / 30,000`; }
content?.addEventListener('input', updateCount); updateCount();
$('#load-sample')?.addEventListener('click', () => {
  $('#title').value = 'Product launch announcement';
  content.value = 'Introducing our revolutionary AI-powered assistant. It guarantees faster decisions for every customer and is the best-in-class solution for content teams.';
  updateCount();
});

$('#review-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const text = $('.button-text', button); const loader = $('.button-loader', button);
  button.disabled = true; text.hidden = true; loader.hidden = false;
  try {
    const form = new FormData(event.currentTarget);
    const data = await api('/api/reviews', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
    window.location.assign(`/review/${data.reviewId}`);
  } catch (error) { toast(error.message, true); button.disabled = false; text.hidden = false; loader.hidden = true; }
});

$$('[data-modal-open]').forEach((button) => button.addEventListener('click', () => { const modal = $(`#${button.dataset.modalOpen}`); if (modal) modal.hidden = false; }));
$$('[data-modal-close]').forEach((button) => button.addEventListener('click', () => button.closest('.modal-backdrop').hidden = true));
$$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.hidden = true; }));


$('#rule-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const modal = form.closest('.modal-backdrop');

  button.disabled = true;

  try {
    await api('/api/rules', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });

    toast('Brand rule saved successfully!');

    form.reset();

    if (modal) modal.hidden = true;

    setTimeout(() => window.location.reload(), 700);

  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$$('.delete-rule').forEach((button) => button.addEventListener('click', async () => {
  if (!confirm('Delete this saved brand rule?')) return;
  try { await api(`/api/rules/${button.dataset.ruleId}`, { method: 'DELETE' }); button.closest('.rule').remove(); toast('Rule deleted.'); }
  catch (error) { toast(error.message, true); }
}));

$$('.decide-issue').forEach((button) => button.addEventListener('click', async () => {
  try { await api(`/api/reviews/${location.pathname.split('/').pop()}/issues/${button.dataset.issueId}/decision`, { method: 'POST', body: JSON.stringify({ decision: button.dataset.decision }) }); window.location.reload(); }
  catch (error) { toast(error.message, true); }
}));
$$('.apply-suggestion').forEach((button) => button.addEventListener('click', async () => {
  button.disabled = true;
  try { const result = await api(`/api/reviews/${location.pathname.split('/').pop()}/issues/${button.dataset.issueId}/apply`, { method: 'POST' }); $('#revised-content').value = result.content; toast('Correction applied to revised content.'); button.closest('.finding').querySelector('.decision-tag').textContent = 'ACCEPTED'; }
  catch (error) { toast(error.message, true); } finally { button.disabled = false; }
}));
$('#submit-review')?.addEventListener('click', async (event) => {
  const button = event.currentTarget; button.disabled = true;
  try { await api(`/api/reviews/${button.dataset.reviewId}/submit`, { method: 'POST', body: JSON.stringify({ content: $('#revised-content').value, note: $('#revision-note').value }) }); toast('Submitted for human review.'); setTimeout(() => window.location.reload(), 600); }
  catch (error) { toast(error.message, true); button.disabled = false; }
});
$$('.reviewer-action').forEach((button) => button.addEventListener('click', async () => {
  button.disabled = true;
  try { await api(`/api/reviews/${button.dataset.reviewId}/action`, { method: 'POST', body: JSON.stringify({ action: button.dataset.action, comment: $('#reviewer-comment').value }) }); toast(button.dataset.action === 'APPROVE' ? 'Content approved by a human reviewer.' : 'Revision request sent.'); setTimeout(() => window.location.reload(), 600); }
  catch (error) { toast(error.message, true); button.disabled = false; }
}));
$('#add-comment')?.addEventListener('click', async (event) => {
  const input = $('#new-comment'); if (!input.value.trim()) return toast('Write a comment first.', true);
  try { await api(`/api/reviews/${event.currentTarget.dataset.reviewId}/comments`, { method: 'POST', body: JSON.stringify({ comment: input.value }) }); window.location.reload(); }
  catch (error) { toast(error.message, true); }
});
