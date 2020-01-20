import React from 'react';
import { API } from '@storybook/api';
import { styled } from '@storybook/theming';
import { Link } from '@storybook/router';
import {
  SyntaxHighlighter,
  SyntaxHighlighterProps,
  SyntaxHighlighterRendererProps,
} from '@storybook/components';

import createElement from 'react-syntax-highlighter/dist/esm/create-element';

const StyledStoryLink = styled(Link)<{ to: string; key: string }>(({ theme }) => ({
  display: 'block',
  textDecoration: 'none',
  borderRadius: theme.appBorderRadius,
  color: 'inherit',

  '&:hover': {
    background: theme.background.hoverable,
  },
}));

const SelectedStoryHighlight = styled.div<{ ref: React.RefObject<HTMLDivElement>; key: string }>(
  ({ theme }) => ({
    background: theme.background.hoverable,
    borderRadius: theme.appBorderRadius,
  })
);

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)<SyntaxHighlighterProps>(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
}));

interface SourceLoc {
  line: number;
  col: number;
}

interface SourceBlock {
  startLoc: SourceLoc;
  endLoc: SourceLoc;
}

const areLocationsEqual = (a: SourceBlock, b: SourceBlock): boolean =>
  a.startLoc.line === b.startLoc.line &&
  a.startLoc.col === b.startLoc.col &&
  a.endLoc.line === b.endLoc.line &&
  a.endLoc.col === b.endLoc.col;

interface LocationsMap {
  [key: string]: SourceBlock;
}
const getLocationKeys = (locationsMap: LocationsMap) =>
  locationsMap
    ? Array.from(Object.keys(locationsMap)).sort(
        (key1, key2) => locationsMap[key1].startLoc.line - locationsMap[key2].startLoc.line
      )
    : [];

interface StoryPanelProps {
  api: API;
}

interface SourceParams {
  source: string;
  locationsMap: LocationsMap;
}
export interface StoryData {
  id: string;
  kind?: string;
  parameters?: {
    storySource?: SourceParams;
  };
}
export const StoryPanel: React.FC<StoryPanelProps> = ({ api }) => {
  const [state, setState] = React.useState<SourceParams & { currentLocation?: SourceBlock }>({
    source: 'loading source...',
    locationsMap: {},
  });

  const story: StoryData | undefined = api.getCurrentStoryData();
  const selectedStoryRef = React.useRef<HTMLDivElement>();
  React.useEffect(() => {
    if (story) {
      const {
        parameters: {
          storySource: { source, locationsMap } = { source: '', locationsMap: {} },
        } = {},
      } = story;
      const currentLocation =
        locationsMap[
          Object.keys(locationsMap).find((key: string) => {
            const sourceLoaderId = key.split('--');
            return story.id.endsWith(sourceLoaderId[sourceLoaderId.length - 1]);
          })
        ];
      setState({ source, locationsMap, currentLocation });
    }
  }, [story ? story.id : null]);
  React.useEffect(() => {
    if (selectedStoryRef.current) {
      selectedStoryRef.current.scrollIntoView();
    }
  }, [selectedStoryRef.current]);

  const { source, locationsMap, currentLocation } = state;

  const createPart = ({ rows, stylesheet, useInlineStyles }: SyntaxHighlighterRendererProps) =>
    rows.map((node, i) =>
      createElement({
        node,
        stylesheet,
        useInlineStyles,
        key: `code-segement${i}`,
      })
    );

  const createStoryPart = ({
    rows,
    stylesheet,
    useInlineStyles,
    location,
    id,
  }: SyntaxHighlighterRendererProps & { location: SourceBlock; id: string }): React.ReactNode => {
    const first = location.startLoc.line - 1;
    const last = location.endLoc.line;

    const storyRows = rows.slice(first, last);
    const storySource = createPart({ rows: storyRows, stylesheet, useInlineStyles });
    const storyKey = `${first}-${last}`;

    if (location && currentLocation && areLocationsEqual(location, currentLocation)) {
      return (
        <SelectedStoryHighlight key={storyKey} ref={selectedStoryRef}>
          {storySource}
        </SelectedStoryHighlight>
      );
    }
    return (
      <StyledStoryLink to={`/story/${id}`} key={storyKey}>
        {storySource}
      </StyledStoryLink>
    );
  };

  const createParts = ({ rows, stylesheet, useInlineStyles }: SyntaxHighlighterRendererProps) => {
    const parts = [];
    let lastRow = 0;

    Object.keys(locationsMap).forEach(key => {
      const location = locationsMap[key];
      const first = location.startLoc.line - 1;
      const last = location.endLoc.line;
      const { kind } = story;
      // source loader ids are differnet from story id
      const sourceIdParts = key.split('--');
      const id = api.storyId(kind, sourceIdParts[sourceIdParts.length - 1]);
      const start = createPart({ rows: rows.slice(lastRow, first), stylesheet, useInlineStyles });
      const storyPart = createStoryPart({ rows, stylesheet, useInlineStyles, location, id });

      parts.push(start);
      parts.push(storyPart);

      lastRow = last;
    });

    const lastPart = createPart({ rows: rows.slice(lastRow), stylesheet, useInlineStyles });

    parts.push(lastPart);

    return parts;
  };

  const lineRenderer = ({
    rows,
    stylesheet,
    useInlineStyles,
  }: SyntaxHighlighterRendererProps): React.ReactNode => {
    // because of the usage of lineRenderer, all lines will be wrapped in a span
    // these spans will receive all classes on them for some reason
    // which makes colours casecade incorrectly
    // this removed that list of classnames
    const myrows = rows.map(({ properties, ...rest }) => ({
      ...rest,
      properties: { className: [] },
    }));

    if (!locationsMap || !Object.keys(locationsMap).length) {
      return createPart({ rows: myrows, stylesheet, useInlineStyles });
    }

    const parts = createParts({ rows: myrows, stylesheet, useInlineStyles });

    return <span>{parts}</span>;
  };
  return (
    <StyledSyntaxHighlighter
      language="jsx"
      showLineNumbers
      renderer={lineRenderer}
      format={false}
      copyable={false}
      padded
    >
      {source}
    </StyledSyntaxHighlighter>
  );
};
