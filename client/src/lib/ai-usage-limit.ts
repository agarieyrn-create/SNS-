export type AiUsageLimitSnapshot = {
  monthlyRequestCount: number;
  monthlyRequestLimit: number;
  monthlyCostMilliUsd: number;
  monthlyBudgetMilliUsd: number;
  perRequestReservationMilliUsd: number;
};

export function getAiUsageLimitStatus(snapshot: AiUsageLimitSnapshot) {
  if (snapshot.monthlyRequestCount >= snapshot.monthlyRequestLimit) {
    return { blocked: true, reason: `月間利用回数の上限（${snapshot.monthlyRequestLimit}回）に達したため、今月のこのAI接続は停止中です。` };
  }
  if (snapshot.monthlyCostMilliUsd + snapshot.perRequestReservationMilliUsd > snapshot.monthlyBudgetMilliUsd) {
    return { blocked: true, reason: `次回利用の予約額を含めると月額上限（$${(snapshot.monthlyBudgetMilliUsd / 1000).toFixed(2)}）を超えるため、このAI接続は停止中です。` };
  }
  return { blocked: false, reason: null };
}
