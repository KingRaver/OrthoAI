# Clinical Reasoning Benchmark (v1)

**Date:** 2026-02-05
**Owner:** OrthoAI

## Purpose
Establish a repeatable, case-based benchmark for orthopedic clinical reasoning quality.

## Scope
- Adult and pediatric orthopedic presentations
- Conservative vs surgical decision-making
- Imaging selection and interpretation guidance
- Red flag identification and escalation
- Rehab and return-to-activity planning

## Case Format
- Input includes history, exam, imaging, and patient factors.
- Expected output includes differential, primary diagnosis, workup, treatment plan, and red flags.
- All cases are evaluated with the scoring rubric below.

## Cases (v1)
1. ACL tear in a pivoting athlete with instability
2. Proximal humerus fracture in an older adult with osteopenia
3. Lumbar radiculopathy with progressive weakness and red flags
4. Hip pain in a young athlete (FAI vs labral tear)
5. Knee pain in middle age (OA vs meniscal tear)
6. Pediatric limping with suspected SCFE
7. Ankle sprain with syndesmotic injury suspicion
8. Shoulder pain with suspected rotator cuff tear

## Scoring Rubric
| Dimension | 0 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| Diagnostic accuracy | Misses key diagnosis | Vague or incorrect | Partial differential | Correct differential | Correct primary + ranked differential |
| Workup selection | Unsafe or wrong | Incomplete | Basic but missing key test | Appropriate tests | Optimal tests with rationale |
| Treatment appropriateness | Unsafe | Poorly aligned | Acceptable but incomplete | Appropriate | Optimal with risk/benefit |
| Red flag detection | Missed | Partial | Adequate | Clear | Clear + escalation thresholds |
| Exam protocol usage | Missing | Minimal | Partial | Good | Structured with grading/ROM |
| Imaging interpretation guidance | Incorrect | Minimal | Basic | Good | Specific sequences/criteria |
| Rehab/RTP guidance | Missing | Minimal | Basic | Good | Protocol-ready with criteria |
| Clarity and structure | Unclear | Some structure | Adequate | Clear | Highly structured and concise |

## Pass Criteria
- Target average score per dimension: >= 3.0
- Red flag detection must be >= 3.5
- Diagnostic accuracy must be >= 3.0
