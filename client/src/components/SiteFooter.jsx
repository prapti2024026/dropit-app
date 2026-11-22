import facebookImg from "../pages/vecteezy_facebook-logo-png-facebook-icon-transparent-white-background_41643208.png";
import instagramImg from "../pages/vecteezy_instagram-logo-png-instagram-icon-transparent_18930413.png";
import linkedinImg from "../pages/vecteezy_linkedin-logo-png-linkedin-icon-transparent-png_18930480.png";
import twitterImg from "../pages/vecteezy_twitter-png-icon_16716486.png";

// Shared footer (was copied into every page before). Styles live in each page's CSS file.
const SiteFooter = () => (
  <footer className="footer-section">
    <div className="footer-container">
      <section className="about-us-section">
        <div className="about-container">
          <div className="about-text">
            <h3>About DropIt</h3>
            <p>
              DropIt is a file-sharing platform powered by gesture recognition. Pick any file or folder,
              grab it with your hand in front of the camera, and the receiver drops it on their device.
            </p>
          </div>
        </div>
      </section>

      <div className="footer-content">
        <div className="footer-column">
          <h5>Features</h5>
          <ul className="footer-links">
            <li><a href="/home">Gesture Recognition</a></li>
            <li><a href="/home">Any File or Folder</a></li>
            <li><a href="/history">Transfer History</a></li>
            <li><a href="/drop">Integrity-Checked Delivery</a></li>
          </ul>
        </div>

        <div className="footer-column">
          <h5>Quick Links</h5>
          <ul className="footer-links">
            <li><a href="/home">Send</a></li>
            <li><a href="/drop">Receive</a></li>
            <li><a href="/history">History</a></li>
          </ul>
        </div>

        <div className="footer-column">
          <h5>Contact Us</h5>
          <div className="contact-info">
            <p><strong>Email:</strong> jamilahmed9500@gmail.com</p>
            <p><strong>Phone:</strong> +88001732856095</p>
            <p><strong>Address:</strong> PAJAMA TECH , Dhaka City</p>
          </div>
        </div>

        <div className="footer-column">
          <h5>Follow Us</h5>
          <div className="social-links">
            <a href="#facebook" className="social-icon"><img src={facebookImg} alt="Facebook" /></a>
            <a href="#twitter" className="social-icon"><img src={twitterImg} alt="Twitter" /></a>
            <a href="#linkedin" className="social-icon"><img src={linkedinImg} alt="LinkedIn" /></a>
            <a href="#instagram" className="social-icon"><img src={instagramImg} alt="Instagram" /></a>
          </div>
        </div>
      </div>

      <div className="footer-copyright">
        <p>&copy; 2026 DropIt. All Rights Reserved.</p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
