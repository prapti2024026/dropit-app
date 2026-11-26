import { Link } from "react-router-dom";
import BrandMark from "./BrandMark";

// Shared footer. Styles live in index.css (.site-footer).
const SiteFooter = () => (
  <footer className="site-footer">
    <div className="site-footer-inner">
      <div>
        <div className="site-footer-brand">
          <BrandMark size={42} />
          DropIt
        </div>
        <p>
          Send any file or folder by grabbing it in front of your camera. The receiver opens their hand and it lands
          on their device.
        </p>
      </div>

      <div>
        <h4>Use DropIt</h4>
        <ul>
          <li><Link to="/dashboard">Home</Link></li>
          <li><Link to="/home">Send a file</Link></li>
          <li><Link to="/drop">Receive a file</Link></li>
          <li><Link to="/history">Transfer history</Link></li>
        </ul>
      </div>

      <div>
        <h4>About</h4>
        <ul>
          <li><a href="/privacy.html">Privacy Policy</a></li>
          <li><a href="/terms.html">Terms of Service</a></li>
          <li><a href="mailto:jamilahmed9500@gmail.com">jamilahmed9500@gmail.com</a></li>
          <li>PAJAMA TECH, Dhaka</li>
        </ul>
      </div>
    </div>
    <p className="site-footer-copy">© 2026 DropIt. A gesture-based file sharing research project.</p>
  </footer>
);

export default SiteFooter;
