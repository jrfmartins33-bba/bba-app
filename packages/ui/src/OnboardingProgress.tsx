import type { OnboardingStep } from "@bba/lib";

type OnboardingProgressProps = {
  steps: OnboardingStep[];
};

export function OnboardingProgress({ steps }: OnboardingProgressProps) {
  const done = steps.filter((step) => step.status === "done").length;
  const percentage = Math.round((done / Math.max(steps.length, 1)) * 100);

  return (
    <div className="onboarding-progress">
      <div className="onboarding-progress__summary">
        <strong>{percentage}%</strong>
        <span>{done} de {steps.length} etapas concluidas</span>
      </div>
      <div className="onboarding-progress__bar" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
      <ol className="onboarding-progress__steps">
        {steps.map((step) => (
          <li key={step.id} className={`onboarding-step onboarding-step--${step.status}`}>
            <span>{step.step_number}</span>
            <p>{step.step_title}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
