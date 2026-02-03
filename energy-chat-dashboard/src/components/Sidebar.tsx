import React from "react";

type Props = {
    kwhUsed: number;
    lastPromptEnergyPct: number;
    totalEnergyPct: number;
    litresWater: number;

    showEUI?: boolean;
    latestPromptWh?: number | null;
    sessionTotalWh?: number | null;
    session1TotalWh?: number | null;
    session?: 1 | 2;
    promptCount?: number;
    // NEW: running average of last 5 prompts (Wh)
    last5AvgWh?: number | null;
};

type Grade = "A" | "B" | "C" | "D" | "E";

function computeGrade(
    sessionTotalWh?: number | null,
    latestPromptWh?: number | null,
    promptCount?: number,
    last5AvgWh?: number | null
): Grade {
    // Until we have at least 5 prompts, always show Label A
    if (!promptCount || promptCount < 5) {
        return "A";
    }

    // Prefer the running average of the last 5 prompts; fall back if needed
    let v: number;
    if (typeof last5AvgWh === "number") {
        v = last5AvgWh;
    } else if (typeof sessionTotalWh === "number") {
        v = sessionTotalWh;
    } else if (typeof latestPromptWh === "number") {
        v = latestPromptWh;
    } else {
        v = 0;
    }

    // New Wh thresholds
    if (v <= 0.05) return "A";
    if (v <= 0.15) return "B";
    if (v <= 0.5) return "C";
    if (v <= 1.5) return "D";
    return "E";
}

export default function Sidebar(props: Props) {
    const {
        showEUI = false,
        latestPromptWh,
        sessionTotalWh,
        session1TotalWh,
        session = 1,
        promptCount,
        last5AvgWh, // NEW
    } = props;

    // If this is the control group, hide the sidebar entirely.
    if (!showEUI) {
        return null;
    }

    const lastWh = typeof latestPromptWh === "number" ? latestPromptWh : 0;
    const totalWh = typeof sessionTotalWh === "number" ? sessionTotalWh : 0;

    const grade = computeGrade(sessionTotalWh, latestPromptWh, promptCount, last5AvgWh);
    const impactGradeClass = `e-impact-grade e-impact-grade-${grade}`;

    return (
        <div className="sidebar-inner">
            <div className="energy-dashboard-outer">
                <div className="energy-dashboard-inner">
                    <h1>Energy Dashboard</h1>
                    <p className="subtitle">
                        Learn about the energy efficiency of your LLM use here!
                    </p>

                    <div className="section">
                        <div className="label">Current Prompt:</div>
                        <div className="value">
                            {lastWh > 0 ? `${lastWh.toFixed(2)} Wh` : "0 Wh"}
                        </div>
                    </div>

                    <div className="section">
                        <div className="label">Current Session:</div>
                        <div className="value">
                            {totalWh > 0 ? `${totalWh.toFixed(2)} Wh` : "0 Wh"}
                        </div>
                    </div>

                    <div className="section">
                        <p className="info-title">You might find this useful to know:</p>
                        <p className="info-text">
                            The average LLM response requires about <strong>0.34 Wh</strong> to be
                            generated (roughly the same as using an LED bulb for ~2 minutes).
                        </p>
                    </div>

                    <div className="section">
                    <p className="info-title">Shorter LLM responses = less energy!</p>
                        
                    </div>

                    <div className="section">
                        <div className="impact-heading">Environmental Impact Score:</div>
                        <div className={impactGradeClass}>{grade}</div>
                    </div>

                    <p className="note">
                        <strong>Note:</strong> Impact scores reflect the system's environmental
                        impact as calculated from this session's running energy use.
                    </p>

                    <div className="session-metrics">
                        {typeof promptCount === "number" && promptCount > 0 && (
                            <span>{promptCount} prompts this session</span>
                        )}
                        {session === 2 && typeof session1TotalWh === "number" && (
                            <>
                                {typeof promptCount === "number" && promptCount > 0 && " • "}
                                <span>
                                    Session 1 total: {session1TotalWh.toFixed(2)} Wh
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}