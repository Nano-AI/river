try {
  const theme = localStorage.getItem('river.theme');
  document.documentElement.dataset.theme = ['light', 'dark'].includes(theme) ? theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch { document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
document.querySelector('meta[name="theme-color"]').content = document.documentElement.dataset.theme === 'dark' ? '#10201b' : '#edf2ef';
