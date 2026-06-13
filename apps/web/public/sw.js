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
  event.waitUntil(clients.openWindow(url));
});
