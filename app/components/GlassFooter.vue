<template>
  <footer class="glass-footer">
    <span>Built by <a href="https://btao.org" target="_blank" rel="noopener">Tao</a></span>
    <span class="glass-footer__dot">&middot;</span>
    <a href="https://github.com/taobojlen/parrot.garden" target="_blank" rel="noopener">Source</a>
  </footer>
</template>

<style scoped>
.glass-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  margin: 0 auto 1.25rem;
  width: fit-content;
  border: none;
  border-radius: 99em;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  color: rgba(209, 224, 232, 0.65);
  font-size: 13px;
  font-weight: 500;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 1.8px 3px 0px -2px rgba(255, 255, 255, 0.15),
    inset -2px -2px 0px -2px rgba(255, 255, 255, 0.12),
    inset -3px -8px 1px -6px rgba(255, 255, 255, 0.08),
    inset -0.3px -1px 4px 0px rgba(0, 0, 0, 0.24),
    inset -1.5px 2.5px 0px -2px rgba(0, 0, 0, 0.2),
    inset 0px 3px 4px -2px rgba(0, 0, 0, 0.2),
    inset 2px -6.5px 1px -4px rgba(0, 0, 0, 0.1),
    0px 1px 5px 0px rgba(0, 0, 0, 0.2),
    0px 6px 16px 0px rgba(0, 0, 0, 0.16);
}

.glass-footer a {
  color: rgba(209, 224, 232, 0.75);
  text-decoration: none;
  transition: color 200ms;
}

.glass-footer a:hover {
  color: var(--color-pale-sky);
}

.glass-footer__dot {
  opacity: 0.4;
}
</style>
