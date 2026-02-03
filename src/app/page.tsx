import { brand } from "@/lib/brand";
import { HeroSection } from "@/components/landing/HeroSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { SwapSection } from "@/components/landing/SwapSection";
import { GallerySection } from "@/components/landing/GallerySection";
import { MainHeader } from "@/components/MainHeader";
import { TokenSection } from "@/components/landing/TokenSection";
import { RoadmapSection } from "@/components/landing/RoadmapSection";

export default function FroggyLanding() {
    //Main page section
    return (
        <div className="min-h-screen w-full" style={{ background: brand.bg, color: brand.text }}>
            <MainHeader />

            {/* Hero */}
            <HeroSection />

            {/* Token Section */}
            <TokenSection />

            {/* Swap */}
            <SwapSection />

            {/* Gallery */}
            <GallerySection />

            {/* Roadmap */}
            <RoadmapSection />

            {/* FAQ */}
            <FaqSection />

            {/* Footer */}
            <FooterSection />

        </div>
    );
}
