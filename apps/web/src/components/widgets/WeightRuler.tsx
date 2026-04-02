import React, { useMemo } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import './WeightRuler.css';

// 将重量值映射到 0~1 范围（用于定位标记指示针）
function normalizeWeight(weight: number, minWeight: number, maxWeight: number): number {
  if (maxWeight === minWeight) return 0.5;
  return (weight - minWeight) / (maxWeight - minWeight);
}

// 根据 0~1 的归一化重量比值计算 hsl 色值（最轻=蓝色≈195°, 最重=红色≈0°）
function weightRatioToHsl(ratio: number): string {
  const hue = Math.round(195 - ratio * 195);
  const lightness = Math.round(65 - ratio * 10);
  return `hsl(${hue}, 80%, ${lightness}%)`;
}

interface MarkerProps {
  positionPercent: number;
  pinColor: string;
  badgeText: string;
  isBadgeHeavy?: boolean;
  cargoName: string;
  cargoWeight: number;
  markerClass: string;
  titleText: string;
}

const WeightMarker: React.FC<MarkerProps> = ({
  positionPercent,
  pinColor,
  badgeText,
  isBadgeHeavy,
  cargoName,
  cargoWeight,
  markerClass,
  titleText,
}) => {
  // CSS 自定义属性只能通过 style 属性动态注入，这是有意为之的合法用法
  // eslint-disable-next-line react/forbid-component-props
  const markerCssVars = {
    '--marker-left': `${positionPercent}%`,
    '--pin-color': pinColor,
  } as React.CSSProperties;

  return (
    <div
      className={`weight-ruler__marker ${markerClass}`}
      /* eslint-disable-next-line react/forbid-dom-props */
      style={markerCssVars}
      title={titleText}
    >
      <div className="weight-ruler__pin" />
      <div className="weight-ruler__tooltip weight-ruler__tooltip--top">
        <span
          className={`weight-ruler__tooltip-badge${isBadgeHeavy ? ' weight-ruler__tooltip-badge--heavy' : ''}`}
        >
          {badgeText}
        </span>
        <span className="weight-ruler__tooltip-name">{cargoName}</span>
        <span className="weight-ruler__tooltip-value">{cargoWeight} kg</span>
      </div>
    </div>
  );
};

export const WeightRuler: React.FC = () => {
  const { project } = useProjectStore();

  const weightStats = useMemo(() => {
    if (!project || project.cargoList.length === 0) return null;

    const cargoList = project.cargoList;

    let heaviestCargo = cargoList[0];
    let lightestCargo = cargoList[0];

    for (const cargo of cargoList) {
      if (cargo.weight > heaviestCargo.weight) heaviestCargo = cargo;
      if (cargo.weight < lightestCargo.weight) lightestCargo = cargo;
    }

    const minWeight = lightestCargo.weight;
    const maxWeight = heaviestCargo.weight;

    const totalWeight = cargoList.reduce(
      (accumulator, cargo) => accumulator + cargo.weight * cargo.quantity,
      0,
    );

    return { heaviestCargo, lightestCargo, minWeight, maxWeight, totalWeight };
  }, [project]);

  if (!weightStats) {
    return (
      <div className="weight-ruler weight-ruler--empty">
        <span className="weight-ruler__label">⚖️ 暂无货物数据</span>
      </div>
    );
  }

  const { heaviestCargo, lightestCargo, minWeight, maxWeight, totalWeight } = weightStats;
  const isSingleCargoType = heaviestCargo.id === lightestCargo.id;

  const heaviestRatio = normalizeWeight(heaviestCargo.weight, minWeight, maxWeight);
  const lightestRatio = normalizeWeight(lightestCargo.weight, minWeight, maxWeight);

  const heaviestPinColor = weightRatioToHsl(heaviestRatio);
  const lightestPinColor = weightRatioToHsl(lightestRatio);

  return (
    <div className="weight-ruler" role="status" aria-label="货物重量色阶温度计">
      {/* 左侧信息摘要 */}
      <div className="weight-ruler__summary">
        <span className="weight-ruler__icon">⚖️</span>
        <span className="weight-ruler__total">
          总重量: <strong>{totalWeight.toLocaleString()} kg</strong>
        </span>
        <span className="weight-ruler__divider">|</span>
        <span className="weight-ruler__range">
          单品区间:&nbsp;
          <span className="weight-ruler__light-label">{minWeight} kg</span>
          &nbsp;~&nbsp;
          <span className="weight-ruler__heavy-label">{maxWeight} kg</span>
        </span>
      </div>

      {/* 渐变色阶温度计主体 */}
      <div className="weight-ruler__thermometer-wrapper">
        {/* 渐变条本体（蓝→红，从左到右表示轻→重） */}
        <div className="weight-ruler__bar" aria-hidden="true" />

        {/* 最轻货物标记（多品种时才显示） */}
        {!isSingleCargoType && (
          <WeightMarker
            positionPercent={lightestRatio * 100}
            pinColor={lightestPinColor}
            badgeText="最轻"
            cargoName={lightestCargo.displayName}
            cargoWeight={lightestCargo.weight}
            markerClass="weight-ruler__marker--light"
            titleText={`最轻: ${lightestCargo.displayName} — ${lightestCargo.weight} kg`}
          />
        )}

        {/* 最重货物标记 */}
        {!isSingleCargoType && (
          <WeightMarker
            positionPercent={heaviestRatio * 100}
            pinColor={heaviestPinColor}
            badgeText="最重"
            isBadgeHeavy
            cargoName={heaviestCargo.displayName}
            cargoWeight={heaviestCargo.weight}
            markerClass="weight-ruler__marker--heavy"
            titleText={`最重: ${heaviestCargo.displayName} — ${heaviestCargo.weight} kg`}
          />
        )}

        {/* 单品种时居中标记 */}
        {isSingleCargoType && (
          <WeightMarker
            positionPercent={50}
            pinColor={heaviestPinColor}
            badgeText="单品"
            cargoName={heaviestCargo.displayName}
            cargoWeight={heaviestCargo.weight}
            markerClass="weight-ruler__marker--single"
            titleText={`${heaviestCargo.displayName} — ${heaviestCargo.weight} kg`}
          />
        )}

        {/* 色阶两端刻度标签 */}
        <div className="weight-ruler__scale">
          <span className="weight-ruler__scale-min">{minWeight} kg</span>
          <span className="weight-ruler__scale-max">{maxWeight} kg</span>
        </div>
      </div>

      {/* 右侧品类计数 */}
      <div className="weight-ruler__meta">
        <span className="weight-ruler__cargo-count">{project.cargoList.length} 种货物</span>
      </div>
    </div>
  );
};
