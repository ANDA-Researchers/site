// Simple parallax scroll limiter - No animation approach
document.addEventListener('DOMContentLoaded', function() {
  // Only run this script on the parallax page
  if (document.body.classList.contains('parallax-page')) {
    // Get the parallax container
    const parallaxContainer = document.querySelector('.parallax-container');

    if (parallaxContainer) {
      // Create a hidden div that will act as a hard stop
      const hardStop = document.createElement('div');
      hardStop.className = 'parallax-hard-stop';
      hardStop.style.height = '2000px'; // Plenty of space before the stop
      hardStop.style.width = '100%';
      hardStop.style.position = 'relative';
      hardStop.style.pointerEvents = 'none';

      // Add the hard stop to the end of the content
      const footerSection = document.querySelector('.footer-section');
      if (footerSection) {
        footerSection.appendChild(hardStop);
      }

      // Set the scroll container to have a specific height
      // This creates a natural hard stop at the bottom
      parallaxContainer.style.height = 'calc(100vh + 2000px)';
    }
  }
});
