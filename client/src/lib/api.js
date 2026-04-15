export async function apiGet(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw await response.json();
  }
  return response.json();
}

export async function apiSend(path, method, payload) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await response.json();
  }
  return response.json();
}

export async function apiUpload(path, formData) {
  const response = await fetch(path, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw await response.json();
  }
  return response.json();
}
