// Fix recharts JSX compatibility with @types/react@18.3.x
import 'recharts';

declare module 'recharts' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface CategoricalChartProps {}
}
