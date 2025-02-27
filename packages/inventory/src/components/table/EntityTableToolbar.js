/* eslint-disable camelcase */
import React, { Fragment, useEffect, useCallback, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Skeleton, SkeletonSize } from '@redhat-cloud-services/frontend-components/Skeleton';
import { tagsFilterState, tagsFilterReducer, mapGroups } from '@redhat-cloud-services/frontend-components/FilterHooks';
import { PrimaryToolbar } from '@redhat-cloud-services/frontend-components/PrimaryToolbar';
import { fetchAllTags, clearFilters, toggleTagModal } from '../../redux/actions';
import debounce from 'lodash/debounce';
import flatMap from 'lodash/flatMap';
import { TagsModal, TEXT_FILTER, reduceFilters, TEXTUAL_CHIP, STALE_CHIP, REGISTERED_CHIP, TAG_CHIP, arrayToSelection } from '../../shared';
import { onDeleteFilter, onDeleteTag } from './helpers';
import {
  useStalenessFilter,
  useTextFilter,
  useRegisteredWithFilter,
  useTagsFilter,
  textFilterState,
  textFilterReducer,
  filtersReducer,
  stalenessFilterReducer,
  stalenessFilterState,
  registeredWithFilterReducer,
  registeredWithFilterState,
} from '../filters';

/**
 * Table toolbar used at top of inventory table.
 * It uses couple of filters and acces redux data along side all passed props.
 * @param {*} props used in this component.
 */
const EntityTableToolbar = ({
  total,
  page,
  perPage,
  filterConfig,
  hasItems,
  children,
  actionsConfig,
  onRefresh,
  hasCheckbox,
  activeFiltersConfig,
  showTags,
  isLoaded,
  items,
  sortBy,
  customFilters,
  hasAccess,
  bulkSelect,
  hideFilters,
  paginationProps,
  onRefreshData,
  loaded,
  showTagModal,
  disableDefaultColumns,
  ...props
}) => {
  const dispatch = useDispatch();
  const reducer = useReducer(filtersReducer([textFilterReducer, stalenessFilterReducer, registeredWithFilterReducer, tagsFilterReducer]), {
    ...textFilterState,
    ...stalenessFilterState,
    ...registeredWithFilterState,
    ...tagsFilterState,
  });
  const filters = useSelector(({ entities: { activeFilters } }) => activeFilters);
  const allTagsLoaded = useSelector(({ entities: { allTagsLoaded } }) => allTagsLoaded);
  const allTags = useSelector(({ entities: { allTags } }) => allTags);
  const additionalTagsCount = useSelector(({ entities: { additionalTagsCount } }) => additionalTagsCount);
  const [nameFilter, nameChip, textFilter, setTextFilter] = useTextFilter(reducer);
  const [stalenessFilter, stalenessChip, staleFilter, setStaleFilter] = useStalenessFilter(reducer);
  const [registeredFilter, registeredChip, registeredWithFilter, setRegisteredWithFilter] = useRegisteredWithFilter(reducer);
  const { tagsFilter, tagsChip, selectedTags, setSelectedTags, filterTagsBy, seFilterTagsBy } = useTagsFilter(
    allTags,
    allTagsLoaded,
    additionalTagsCount,
    () => dispatch(toggleTagModal(true)),
    reducer
  );

  /**
   * Debounced function for fetching all tags.
   */
  const debounceGetAllTags = useCallback(
    debounce((config, options) => {
      if (showTags && !hasItems && hasAccess) {
        dispatch(
          fetchAllTags(config, {
            ...customFilters,
            ...options,
          })
        );
      }
    }, 800),
    [customFilters?.tags]
  );

  /**
   * Function to dispatch load systems and fetch all tags.
   */
  const onRefreshDataInner = useCallback(
    (options) => {
      if (hasAccess) {
        onRefreshData(options);
        if (showTags && !hasItems) {
          dispatch(fetchAllTags(filterTagsBy, { ...customFilters, filters: options?.filters || filters }));
        }
      }
    },
    [customFilters?.tags]
  );

  const enabledFilters = {
    name: !(hideFilters.all && hideFilters.name !== false) && !hideFilters.name,
    stale: !(hideFilters.all && hideFilters.stale !== false) && !hideFilters.stale,
    registeredWith: !(hideFilters.all && hideFilters.registeredWith !== false) && !hideFilters.registeredWith,
    tags: !(hideFilters.all && hideFilters.tags !== false) && !hideFilters.tags,
  };

  /**
   * Function used to update data, it either calls `onRefresh` from props or dispatches `onRefreshData`.
   * `onRefresh` function takes two parameters
   *   * entire config with new changes.
   *   * callback to update data.
   * @param {*} config new config to fetch data.
   */
  const updateData = (config) => {
    if (hasAccess) {
      onRefreshDataInner(config);
    }
  };

  /**
   * Debounced `updateData` function.
   */
  const debouncedRefresh = useCallback(
    debounce((config) => updateData(config), 800),
    [sortBy?.key, sortBy?.direction]
  );

  /**
   * Component did mount effect to calculate actual filters from redux.
   */
  useEffect(() => {
    const { textFilter, tagFilters, staleFilter, registeredWithFilter } = reduceFilters(filters);
    debouncedRefresh();
    enabledFilters.name && setTextFilter(textFilter);
    enabledFilters.stale && setStaleFilter(staleFilter);
    enabledFilters.registeredWith && setRegisteredWithFilter(registeredWithFilter);
    enabledFilters.tags && setSelectedTags(tagFilters);
  }, []);

  /**
   * Function used to change text filter.
   * @param {*} value new value used for filtering.
   * @param {*} debounced if debounce function should be used.
   */
  const onSetTextFilter = (value, debounced = true) => {
    const trimmedValue = value.trim();

    const textualFilter = filters?.find((oneFilter) => oneFilter.value === TEXT_FILTER);
    if (textualFilter) {
      textualFilter.filter = trimmedValue;
    } else {
      filters?.push({ value: TEXT_FILTER, filter: trimmedValue });
    }

    const refresh = debounced ? debouncedRefresh : updateData;
    refresh({ page: 1, perPage, filters });
  };

  /**
   * General function to apply filter (excluding tag and text).
   * @param {*} value new value to be set of specified filter.
   * @param {*} filterKey which filter should be changed.
   * @param {*} refresh refresh callback function.
   */
  const onSetFilter = (value, filterKey, refresh) => {
    const newFilters = [...filters?.filter((oneFilter) => !oneFilter.hasOwnProperty(filterKey)), { [filterKey]: value }];
    refresh({ page: 1, perPage, filters: newFilters });
  };

  const shouldReload = page && perPage && filters && (!hasItems || items) && loaded;

  useEffect(() => {
    if (shouldReload && showTags && enabledFilters.tags) {
      debounceGetAllTags(filterTagsBy, { filters });
    }
  }, [filterTagsBy, customFilters?.tags]);

  useEffect(() => {
    if (shouldReload && enabledFilters.name) {
      onSetTextFilter(textFilter, true);
    }
  }, [textFilter]);

  useEffect(() => {
    if (shouldReload && enabledFilters.stale) {
      onSetFilter(staleFilter, 'staleFilter', debouncedRefresh);
    }
  }, [staleFilter]);

  useEffect(() => {
    if (shouldReload && enabledFilters.registeredWith) {
      onSetFilter(registeredWithFilter, 'registeredWithFilter', debouncedRefresh);
    }
  }, [registeredWithFilter]);

  useEffect(() => {
    if (shouldReload && showTags && enabledFilters.tags) {
      onSetFilter(mapGroups(selectedTags), 'tagFilters', debouncedRefresh);
    }
  }, [selectedTags]);

  /**
   * Mapper to simplify removing of any filter.
   */
  const deleteMapper = {
    [TEXTUAL_CHIP]: () => setTextFilter(''),
    [TAG_CHIP]: (deleted) =>
      setSelectedTags(onDeleteTag(deleted, selectedTags, (selectedTags) => onSetFilter(mapGroups(selectedTags), 'tagFilters', updateData))),
    [STALE_CHIP]: (deleted) => setStaleFilter(onDeleteFilter(deleted, staleFilter)),
    [REGISTERED_CHIP]: (deleted) => setRegisteredWithFilter(onDeleteFilter(deleted, registeredWithFilter)),
  };

  /**
   * Function to create active filters chips.
   */
  const constructFilters = () => {
    return {
      filters: [
        ...(showTags && !hasItems && enabledFilters.tags ? tagsChip : []),
        ...(!hasItems && enabledFilters.name ? nameChip : []),
        ...(!hasItems && enabledFilters.stale ? stalenessChip : []),
        ...(!hasItems && enabledFilters.registeredWith ? registeredChip : []),
        ...(activeFiltersConfig?.filters || []),
      ],
      onDelete: (e, [deleted, ...restDeleted], isAll) => {
        if (isAll) {
          updateData({ page: 1, filters: [] });
          dispatch(clearFilters());
          enabledFilters.name && setTextFilter('');
          enabledFilters.stale && setStaleFilter([]);
          enabledFilters.registeredWith && setRegisteredWithFilter([]);
          enabledFilters.tags && setSelectedTags({});
        } else if (deleted.type) {
          deleteMapper[deleted.type](deleted);
        }

        activeFiltersConfig && activeFiltersConfig.onDelete && activeFiltersConfig.onDelete(e, [deleted, ...restDeleted], isAll);
      },
    };
  };

  /**
   * Function to calculate if any filter is applied.
   */
  const isFilterSelected = () => {
    return (
      textFilter.length > 0 ||
      flatMap(Object.values(selectedTags), (value) => Object.values(value).filter(Boolean)).filter(Boolean).length > 0 ||
      staleFilter?.length > 0 ||
      registeredWithFilter?.length > 0 ||
      activeFiltersConfig?.filters?.length > 0
    );
  };

  const inventoryFilters = [
    ...(!hasItems
      ? [
          ...(enabledFilters.name ? [nameFilter] : []),
          ...(enabledFilters.stale ? [stalenessFilter] : []),
          ...(enabledFilters.registeredWith ? [registeredFilter] : []),
          ...(showTags && enabledFilters.tags ? [tagsFilter] : []),
        ]
      : []),
    ...(filterConfig?.items || []),
  ];

  return (
    <Fragment>
      <PrimaryToolbar
        {...props}
        {...(bulkSelect && {
          bulkSelect: {
            ...bulkSelect,
            isDisabled: bulkSelect?.isDisabled || !hasAccess,
          },
        })}
        className={`ins-c-inventory__table--toolbar ${hasItems || !inventoryFilters.length ? 'ins-c-inventory__table--toolbar-has-items' : ''}`}
        {...(inventoryFilters?.length > 0 && {
          filterConfig: {
            ...(filterConfig || {}),
            isDisabled: !hasAccess,
            items: inventoryFilters?.map((filter) => ({
              ...filter,
              filterValues: {
                placeholder: filter?.filterValues?.placeholder || `Filter by ${filter?.label?.toLowerCase()}`,
                ...filter?.filterValues,
                isDisabled: !hasAccess,
              },
            })),
          },
        })}
        {...(isFilterSelected() && hasAccess && { activeFiltersConfig: constructFilters() })}
        actionsConfig={loaded ? actionsConfig : null}
        pagination={
          loaded ? (
            {
              page,
              itemCount: !hasAccess ? 0 : total,
              isDisabled: !hasAccess,
              perPage,
              onSetPage: (_e, newPage) => onRefreshData({ page: newPage }),
              onPerPageSelect: (_e, newPerPage) => onRefreshData({ page: 1, per_page: newPerPage }),
              ...paginationProps,
            }
          ) : (
            <Skeleton size={SkeletonSize.lg} />
          )
        }
      >
        {children}
      </PrimaryToolbar>
      {(showTags || enabledFilters.tags || showTagModal) && (
        <TagsModal
          customFilters={customFilters}
          filterTagsBy={filterTagsBy}
          onApply={(selected) => setSelectedTags(arrayToSelection(selected))}
          onToggleModal={() => seFilterTagsBy('')}
        />
      )}
    </Fragment>
  );
};

EntityTableToolbar.propTypes = {
  showTags: PropTypes.bool,
  hasAccess: PropTypes.bool,
  filterConfig: PrimaryToolbar.propTypes.filterConfig,
  total: PropTypes.number,
  filters: PropTypes.array,
  hasItems: PropTypes.bool,
  page: PropTypes.number,
  onClearFilters: PropTypes.func,
  toggleTagModal: PropTypes.func,
  perPage: PropTypes.number,
  children: PropTypes.node,
  pagination: PrimaryToolbar.propTypes.pagination,
  actionsConfig: PrimaryToolbar.propTypes.actionsConfig,
  activeFiltersConfig: PrimaryToolbar.propTypes.activeFiltersConfig,
  onRefreshData: PropTypes.func,
  customFilters: PropTypes.shape({
    tags: PropTypes.oneOfType([PropTypes.object, PropTypes.arrayOf(PropTypes.string)]),
  }),
  hideFilters: PropTypes.shape({
    tags: PropTypes.bool,
    name: PropTypes.bool,
    registeredWith: PropTypes.bool,
    stale: PropTypes.bool,
    all: PropTypes.bool,
  }),
  paginationProps: PropTypes.object,
  loaded: PropTypes.bool,
  onRefresh: PropTypes.func,
  hasCheckbox: PropTypes.bool,
  isLoaded: PropTypes.bool,
  items: PropTypes.array,
  sortBy: PropTypes.object,
  bulkSelect: PropTypes.object,
  showTagModal: PropTypes.bool,
  disableDefaultColumns: PropTypes.any,
};

EntityTableToolbar.defaultProps = {
  showTags: false,
  hasAccess: true,
  activeFiltersConfig: {},
  filters: [],
  hideFilters: {},
};

export default EntityTableToolbar;
