export function tapHaptic() {
  import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }).catch(() => {});
}
