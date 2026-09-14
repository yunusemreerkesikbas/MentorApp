// Take over tabs that were already open, so a notification click can reuse one of them.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Mentor", body: "", url: "/panel" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    /* ignore malformed payload */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relative = event.notification.data?.url ?? "/panel";
  const url = new URL(relative, self.location.origin).href;
  // An open Mentor tab is focused and sent there; a new window only when there is none.
  event.waitUntil(
    clients
      .matchAll({ type: "window" })
      .then(([client]) =>
        client
          ? client.focus().then((focused) => focused.navigate(url))
          : clients.openWindow(url),
      )
      .catch(() => clients.openWindow(url)),
  );
});
