// uint32/uint64/uint256 come back as bigint by default
export type UserStateTuple = readonly [bigint, bigint, bigint, bigint, bigint];

export function normalizeUserState(userState: UserStateTuple | undefined) {
    if (!userState) {
        return {
            currentStreak: 0,
            bestStreak: 0,
            totalCheckIns: 0,
            lastCheckInDay: null as number | null,
            lastRecordedBalance: null as bigint | null,
        };
    }

    return {
        currentStreak: Number(userState[0]),
        bestStreak: Number(userState[1]),
        totalCheckIns: Number(userState[2]),
        lastCheckInDay: Number(userState[3]),
        lastRecordedBalance: userState[4],
    };
}
