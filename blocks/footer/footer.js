/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // Create custom Vitamix footer
  block.textContent = '';
  const footer = document.createElement('div');
  footer.className = 'footer-content';

  footer.innerHTML = `
    <div class="footer-copyright">
      <p>© 2025 Vita-Mix Corporation</p>
    </div>
    <div class="footer-social">
      <h4>Follow Us</h4>
      <ul class="social-icons">
        <li><a href="https://www.facebook.com/VitamixCorporation" title="Facebook" target="_blank" rel="noopener">Facebook</a></li>
        <li><a href="https://twitter.com/vitamix" title="Twitter" target="_blank" rel="noopener">Twitter</a></li>
        <li><a href="https://www.pinterest.com/vitamix/" title="Pinterest" target="_blank" rel="noopener">Pinterest</a></li>
        <li><a href="https://www.youtube.com/vitamixvideos" title="Youtube" target="_blank" rel="noopener">Youtube</a></li>
        <li><a href="https://instagram.com/vitamix" title="Instagram" target="_blank" rel="noopener">Instagram</a></li>
      </ul>
    </div>
  `;

  block.append(footer);
}
