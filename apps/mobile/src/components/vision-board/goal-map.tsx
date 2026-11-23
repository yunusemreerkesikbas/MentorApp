import { useQuery } from "@tanstack/react-query";
import { Linking, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PROVINCES, MAP_VIEWBOX } from "@mentor/core/turkey-provinces";
import type { CityDto } from "@mentor/types";
import { fetchGoalCities } from "../../lib/vision-board-api.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { AppText, Chip, Skeleton } from "../ui/index.js";

export function GoalMap({ selected, onCity }: { selected: string | null; onCity: (c: CityDto) => void }) {
  const t = useTranslations("visionBoard");
  const { palette, space } = useThemeTokens();
  const query = useQuery({ queryKey: ["vision", "cities"], queryFn: fetchGoalCities });
  if (query.isPending) return <Skeleton height={120} />;
  if (query.isError) return <Chip label={t("retry")} onPress={() => void query.refetch()} />;
  return <View style={{ gap: space.xs }}>
    <View style={{ width: "100%", aspectRatio: 1000 / 420 }}>
      <Svg width="100%" height="100%" viewBox={MAP_VIEWBOX}>
        {query.data.cities.map(city => {
          const shape = PROVINCES[city.code];
          return shape && <Path key={city.code} d={shape.d} accessibilityLabel={city.name}
            onPress={() => onCity(city)} stroke={palette.bg} strokeWidth={1}
            fill={selected === city.code ? palette.accent : palette.secondary} />;
        })}
      </Svg>
    </View>
    <AppText variant="micro" accessibilityRole="link" onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}>
      © OpenStreetMap
    </AppText>
  </View>;
}
