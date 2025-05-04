---
layout: home-parallax
---

<div class="parallax-container">

    <!-- Parallax Group 1: Hero Section -->
    <div class="parallax-group hero-section">
        <div class="parallax-layer layer-back" style="background-image: url('{{ site.baseurl }}/assets/img/parallax-bg-city.jpg');">
            <!-- Farthest back layer - e.g., blurred city skyline -->
        </div>
        <div class="parallax-layer layer-mid" style="background-image: url('{{ site.baseurl }}/assets/img/parallax-bg-road.png');">
            <!-- Optional middle layer - e.g., road texture, transparent PNG -->
        </div>
        <div class="parallax-layer layer-car" style="background-image: url('{{ site.baseurl }}/assets/img/parallax-car.png');">
             <!-- The car layer - use a transparent PNG of the car -->
        </div>
        <div class="parallax-layer layer-base">
            <!-- This layer holds the initial content and scrolls normally -->
            <div class="hero-content-wrapper">
                <!-- Recreate the text from the example image -->
                <h1>The Future of Transportation is Here.</h1>
                <p>Pioneering autonomous vehicle technology through cutting-edge research in computer vision, networking, and machine learning.</p>
                <a href="#main-content" class="btn-learn-more">Learn More</a>
            </div>
        </div>
    </div>

    <!-- Content Section: The rest of your page -->
    <div id="main-content" class="content-section layer-base">
        <div class="wrapper">
            <div class="home"> <!-- Keep your original 'home' class for styling -->

            <!-- === START: Your Original Content === -->
            <div class="recruitment-notice" style="background-color: var(--light-background); padding: 1.5rem; border-radius: 8px; text-align: center; margin-bottom: 2.5rem; border-left: 3px solid var(--accent-color);">
                <strong style="font-size: 1.2em;">We are recruiting!</strong> Interested in joining our Lab? <a href="joinus" style="color: var(--accent-color); font-weight: 500;">Learn more and apply here</a>.
            </div>

            <h1 class="page-heading">Welcome to ANDA Lab</h1>
            <p class="lead">Advanced Network Design and Analysis Lab (ANDA Lab) is a research laboratory dedicated to exploring cutting-edge technologies in the fields of Autonomous Vehicles including Computer Vision and Networking. Located at Soongsil University in Seoul, South Korea, our lab fosters a collaborative and innovative environment for research and development.</p>

    <h2>Research Areas</h2>
    <div class="research-grid">
        <div class="research-item">
            <h3>Autonomous Vehicles</h3>
            <p>Developing algorithms for autonomous vehicle navigation, perception, and control.</p>
        </div>

        <div class="research-item">
            <h3>Machine Learning</h3>
            <p>Applying machine learning techniques to various domains, including computer vision, natural language processing, and data analysis.</p>
        </div>

        <div class="research-item">
            <h3>Computer Vision</h3>
            <p>Developing algorithms for image and video analysis, object detection, and recognition.</p>
        </div>

        <div class="research-item">
            <h3>Networking</h3>
            <p>Researching network architectures, protocols, and applications for efficient and reliable communication.</p>
        </div>

        <div class="research-item">
            <h3>Edge Computing</h3>
            <p>Exploring edge computing technologies for decentralized and low-latency applications.</p>
        </div>

        <div class="research-item">
            <h3>Cloud Computing</h3>
            <p>Investigating cloud computing platforms and services for scalable and cost-effective solutions.</p>
        </div>

        <div class="research-item">
            <h3>Sensor Networks</h3>
            <p>Designing and deploying sensor networks for data collection and analysis in various environments.</p>
        </div>
    </div>
            </div><!-- /.home -->
        </div><!-- /.wrapper -->
    </div><!-- /.content-section -->

    <!-- Footer Section: Include the footer inside the parallax container -->
    <div class="footer-section layer-base">
        {%- include footer.html -%}
    </div><!-- /.footer-section -->

</div> <!-- /.parallax-container -->
