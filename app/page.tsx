"use client";

import { useClient } from "./context/ClientContext";
import BusinessGate from "./components/BusinessGate";
import NavBar from "./components/NavBar";
import ProgressRail from "./components/ProgressRail";
import CursorSpotlight from "./components/CursorSpotlight";
import ParallaxBackdrops from "./components/ParallaxBackdrops";
import BackToTop from "./components/BackToTop";
import PresentationControls from "./components/PresentationControls";
import Hero from "./sections/Hero";
import ClientOnboarding from "./sections/ClientOnboarding";
import DomainResearch from "./sections/DomainResearch";
import WorkspaceSetup from "./sections/WorkspaceSetup";
import DomainPurchase from "./sections/DomainPurchase";
import MailboxCreation from "./sections/MailboxCreation";
import ExportInstantly from "./sections/ExportInstantly";
import Configuration from "./sections/Configuration";
import WarmupEngine from "./sections/WarmupEngine";
import FinalQA from "./sections/FinalQA";
import Delivery from "./sections/Delivery";

export default function Page() {
  const { client } = useClient();

  return (
    <>
      <main className="relative bg-ink-950 text-white">
        {client && <NavBar />}
        {client && <ProgressRail />}
        {client && <CursorSpotlight />}
        {client && <ParallaxBackdrops />}
        <Hero />
        <DomainResearch />
        <ClientOnboarding />
        <WorkspaceSetup />
        <DomainPurchase />
        <MailboxCreation />
        <Configuration />
        <ExportInstantly />
        <WarmupEngine />
        <FinalQA />
        <Delivery />
      </main>
      {client && <PresentationControls />}
      {client && <BackToTop />}
      {!client && <BusinessGate />}
    </>
  );
}
