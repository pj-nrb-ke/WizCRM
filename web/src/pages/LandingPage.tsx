import { useEffect } from 'react';
import { LandingNav } from '../components/landing/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { LogoMarquee } from '../components/landing/LogoMarquee';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { DashboardShowcase } from '../components/landing/DashboardShowcase';
import { BenefitsSection } from '../components/landing/BenefitsSection';
import { AiSection } from '../components/landing/AiSection';
import { TeamSection } from '../components/landing/TeamSection';
import { AnalyticsSection } from '../components/landing/AnalyticsSection';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { PricingPreview } from '../components/landing/PricingPreview';
import { FinalCta } from '../components/landing/FinalCta';
import { LandingFooter } from '../components/landing/LandingFooter';

export function LandingPage() {
  useEffect(() => {
    // Override body background for landing page
    const prevBg = document.body.style.background;
    document.body.style.background = '#ffffff';
    return () => {
      document.body.style.background = prevBg;
    };
  }, []);

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        overflowX: 'hidden',
      }}
    >
      <LandingNav />
      <main>
        <HeroSection />
        <LogoMarquee />
        <FeaturesGrid />
        <DashboardShowcase />
        <BenefitsSection />
        <AiSection />
        <TeamSection />
        <AnalyticsSection />
        <TestimonialsSection />
        <PricingPreview />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
