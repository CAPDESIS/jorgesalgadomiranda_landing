import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '../assets/js/email-validation.js';

// Runs the real contact-form controller from index.html (not a copy) against
// happy-dom with a fetch mock, so a double-submit regression fails here.

const ROOT = join(import.meta.dir, '..');
const START = '// ============ CONTACT FORM';
const END = '// ============ ATTRIBUTION SIGNATURE';

function loadContactController(): string {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('contact form controller markers not found in index.html');
  }
  return html.slice(start, end);
}

function extractFormMarkup(): string {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const match = html.match(/<form class="contact-form" id="contact-form"[\s\S]*?<\/form>/);
  if (!match) throw new Error('contact-form markup not found in index.html');
  return match[0];
}

const CONTROLLER = loadContactController();
const FORM_MARKUP = extractFormMarkup();

type Deferred = {
  promise: Promise<Response>;
  resolve: (res: Response) => void;
  reject: (err: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: (res: Response) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function okResponse(): Response {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;
let fetchCalls: Deferred[] = [];

function mountFormAndController(): HTMLFormElement {
  document.body.innerHTML = FORM_MARKUP;
  // Controller is an inline script in index.html; it only reads the DOM and
  // window.JSMEmailValidation (loaded above from assets/js/email-validation.js).
  new Function(CONTROLLER)();
  const form = document.getElementById('contact-form') as HTMLFormElement;
  fillValidFields(form);
  return form;
}

function fillValidFields(form: HTMLFormElement): void {
  (form.querySelector('#cf-name') as HTMLInputElement).value = 'Persona Prueba';
  (form.querySelector('#cf-email') as HTMLInputElement).value = 'persona@empresa.mx';
  (form.querySelector('#cf-message') as HTMLTextAreaElement).value = 'Hola, quisiera una cotizacion.';
}

function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fetchCalls = [];
  (globalThis as any).fetch = (..._args: unknown[]) => {
    const d = deferred();
    fetchCalls.push(d);
    return d.promise;
  };
});

afterEach(() => {
  (globalThis as any).fetch = originalFetch;
  document.body.innerHTML = '';
});

describe('contact form in-flight guard (index.html)', () => {
  test('repeated submits while a request is in flight send exactly one POST', async () => {
    const form = mountFormAndController();

    submit(form);
    submit(form);
    submit(form);
    await flush();

    expect(fetchCalls.length).toBe(1);

    fetchCalls[0].resolve(okResponse());
    await flush();
    await flush();
  });

  test('button stays disabled while in flight and is restored after success', async () => {
    const form = mountFormAndController();
    const btn = form.querySelector('#cf-submit') as HTMLButtonElement;

    submit(form);
    await flush();
    expect(btn.disabled).toBe(true);

    submit(form);
    await flush();
    expect(fetchCalls.length).toBe(1);

    fetchCalls[0].resolve(okResponse());
    await flush();
    await flush();
    expect(btn.disabled).toBe(false);
  });

  test('a retry is allowed after the first request completes successfully', async () => {
    const form = mountFormAndController();

    submit(form);
    await flush();
    fetchCalls[0].resolve(okResponse());
    await flush();
    await flush();

    // A successful send calls form.reset(), so refill the fields before retrying.
    fillValidFields(form);
    (form.querySelector('#cf-message') as HTMLTextAreaElement).value = 'Segundo mensaje de prueba.';
    submit(form);
    await flush();

    expect(fetchCalls.length).toBe(2);
    fetchCalls[1].resolve(okResponse());
    await flush();
    await flush();
  });

  test('a retry is allowed after the first request fails with a network error', async () => {
    const form = mountFormAndController();

    submit(form);
    await flush();
    fetchCalls[0].reject(new TypeError('network down'));
    await flush();
    await flush();

    const btn = form.querySelector('#cf-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    submit(form);
    await flush();
    expect(fetchCalls.length).toBe(2);
    fetchCalls[1].resolve(okResponse());
    await flush();
    await flush();
  });

  test('a submit that fails validation does not lock the form', async () => {
    const form = mountFormAndController();
    (form.querySelector('#cf-message') as HTMLTextAreaElement).value = 'corto';

    submit(form);
    await flush();
    expect(fetchCalls.length).toBe(0);

    (form.querySelector('#cf-message') as HTMLTextAreaElement).value = 'Ahora si es un mensaje valido.';
    submit(form);
    await flush();
    expect(fetchCalls.length).toBe(1);
    fetchCalls[0].resolve(okResponse());
    await flush();
    await flush();
  });
});
