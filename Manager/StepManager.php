<?php

namespace Innova\PathBundle\Manager;

use Claroline\CoreBundle\Entity\Activity\ActivityParameters;
use Claroline\CoreBundle\Entity\Resource\Activity;
use Doctrine\Common\Persistence\ObjectManager;
use Claroline\CoreBundle\Manager\ResourceManager;
use Innova\PathBundle\Entity\InheritedResource;
use Innova\PathBundle\Entity\Step;
use Innova\PathBundle\Entity\Path\Path;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Translation\TranslatorInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Claroline\CoreBundle\Manager\MaskManager;

class StepManager
{
    /**
     * Current session
     * @var \Symfony\Component\HttpFoundation\Session\SessionInterface
     */
    protected $session;

    /**
     * Translation manager
     * @var \Symfony\Component\Translation\TranslatorInterface
     */
    protected $translator;

    /**
     *
     * @var \Doctrine\Common\Persistence\ObjectManager $om
     */
    protected $om;

    /**
     * Resource Manager
     * @var \Claroline\CoreBundle\Manager\ResourceManager
     */
    protected $resourceManager;

    /**
     * Container Interface
     * @var Symfony\Component\DependencyInjection\ContainerInterface
     */
    protected $container;

    /**
     * @var MaskManager
     */
    protected $maskManager;

    /**
     * Class constructor
     * @param \Doctrine\Common\Persistence\ObjectManager                 $om
     * @param \Claroline\CoreBundle\Manager\ResourceManager              $resourceManager
     * @param \Symfony\Component\HttpFoundation\Session\SessionInterface $session
     * @param \Symfony\Component\Translation\TranslatorInterface         $translator
     * @param \Symfony\Component\DependencyInjection\ContainerInterface  $container
     * @param \Claroline\CoreBundle\Manager\MaskManager                  $maskManager
     */
    public function __construct(
        ObjectManager            $om,
        ResourceManager          $resourceManager,
        SessionInterface         $session,
        TranslatorInterface      $translator,
        ContainerInterface       $container,
        MaskManager              $maskManager
    )
    {
        $this->om              = $om;
        $this->resourceManager = $resourceManager;
        $this->session         = $session;
        $this->translator      = $translator;
        $this->container       = $container;
        $this->maskManager     = $maskManager;
    }

    /**
     * Get a step by ID
     * @param  integer   $stepId
     * @return null|Step
     */
    public function get($stepId)
    {
        return $this->om->getRepository("InnovaPathBundle:Step")->findOneById($stepId);
    }

    /**
     * Create a new step from JSON structure
     * @param  \Innova\PathBundle\Entity\Path\Path $path          Parent path of the step
     * @param  integer                             $level         Depth of the step in the path
     * @param  \Innova\PathBundle\Entity\Step      $parent        Parent step of the step
     * @param  integer                             $order         Order of the step relative to its siblings
     * @param  \stdClass                           $stepStructure Data about the step
     * @return \Innova\PathBundle\Entity\Step      Edited step
     */
    public function create(Path $path, $level = 0, Step $parent = null, $order = 0, \stdClass $stepStructure)
    {
        $step = new Step();

        return $this->edit($path, $level, $parent, $order, $stepStructure, $step);
    }

    /**
     * Update an existing step from JSON structure
     * @param  \Innova\PathBundle\Entity\Path\Path $path          Parent path of the step
     * @param  integer                             $level         Depth of the step in the path
     * @param  \Innova\PathBundle\Entity\Step      $parent        Parent step of the step
     * @param  integer                             $order         Order of the step relative to its siblings
     * @param  \stdClass                           $stepStructure Data about the step
     * @param  \Innova\PathBundle\Entity\Step      $step          Current step to edit
     * @return \Innova\PathBundle\Entity\Step      Edited step
     */
    public function edit(Path $path, $level = 0, Step $parent = null, $order = 0, \stdClass $stepStructure, Step $step)
    {
        // Update step properties
        $step->setPath($path);
        $step->setParent($parent);
        $step->setLvl($level);
        $step->setOrder($order);

        $this->updateParameters($step, $stepStructure);
        $this->updateActivity($step, $stepStructure);

        // Save modifications
        $this->om->persist($step);

        return $step;
    }

    /**
     * @param  \Innova\PathBundle\Entity\Step               $step
     * @param  \stdClass                                    $stepStructure
     * @return \Innova\PathBundle\Manager\PublishingManager
     * @throws \LogicException
     */
    public function updateActivity(Step $step, \stdClass $stepStructure)
    {
        $newActivity = false;
        $activity = $step->getActivity();
        if (empty($activity)) {
            if (!empty($stepStructure->activityId)) {
                // Load activity from DB
                $activity = $this->om->getRepository('ClarolineCoreBundle:Resource\Activity')->findOneById($stepStructure->activityId);
                if (empty($activity)) {
                    // Can't find Activity => create a new one
                    $newActivity = true;
                    $activity = new Activity();
                }
            } else {
                // Create new activity
                $newActivity = true;
                $activity = new Activity();
            }
        }

        // Update activity properties
        if (!empty($stepStructure->name)) {
            $name = $stepStructure->name;
        } else {
            // Create a default name
            $name = $step->getPath()->getName() . ' - ' . Step::DEFAULT_NAME . ' ' . $step->getOrder();
        }
        $activity->setName($name);
        $activity->setTitle($name);

        $description = !empty($stepStructure->description) ? $stepStructure->description : ' ';
        $activity->setDescription($description);

        // Link resource if needed
        if (!empty($stepStructure->primaryResource) && !empty($stepStructure->primaryResource[0]) && !empty($stepStructure->primaryResource[0]->resourceId)) {
            $resource = $this->om->getRepository('ClarolineCoreBundle:Resource\ResourceNode')->findOneById($stepStructure->primaryResource[0]->resourceId);
            if (!empty($resource)) {
                $activity->setPrimaryResource($resource);
            } else {
                $warning = $this->translator->trans('warning_primary_resource_deleted', array('resourceId' => $stepStructure->primaryResource[0]->resourceId, 'resourceName' => $stepStructure->primaryResource[0]->name), "innova_tools");
                $this->session->getFlashBag()->add('warning', $warning);
                $stepStructure->primaryResource = array ();
            }
        } elseif ($activity->getPrimaryResource()) {
            // Step had a resource which has been deleted
            $activity->setPrimaryResource(null);
        }

        // Generate Claroline resource node and rights
        if ($newActivity) {
            // It's a new Activity, so use Step parameters
            $activity->setParameters($step->getParameters());

            $activityType = $this->om->getRepository('ClarolineCoreBundle:Resource\ResourceType')->findOneByName('activity');
            $creator = $step->getPath()->getCreator();
            $workspace = $step->getWorkspace();

            // Store Activity in same directory than parent Path
            $parent = $step->getPath()->getResourceNode()->getParent();
            if (empty($parent)) {
                $parent = $this->resourceManager->getWorkspaceRoot($workspace);
            }

            $activity = $this->resourceManager->create($activity, $activityType, $creator, $workspace, $parent);
        } else {
            // Activity already exists => update ResourceNode
            $activity->getResourceNode()->setName($activity->getTitle());
        }

        // Update JSON structure
        $stepStructure->activityId = $activity->getId();

        // Store Activity in Step
        $step->setActivity($activity);

        return $this;
    }

    public function updateParameters(Step $step, \stdClass $stepStructure)
    {
        $parameters = $step->getParameters();
        if (empty($parameters)) {
            $parameters = new ActivityParameters();
        }

        // Update parameters properties
        $duration = !empty($stepStructure->duration) ? $stepStructure->duration : null;
        $parameters->setMaxDuration($duration);

        $withTutor = !empty($stepStructure->withTutor) ? $stepStructure->withTutor : false;
        $parameters->setWithTutor($withTutor);

        $who = !empty($stepStructure->who) ? $stepStructure->who : null;
        $parameters->setWho($who);

        $where = !empty($stepStructure->where) ? $stepStructure->where : null;
        $parameters->setWhere($where);

        // Set resources
        $this->updateSecondaryResources($parameters, $stepStructure);

        // Persist parameters to generate ID
        $this->om->persist($parameters);

        // Store parameters in Step
        $step->setParameters($parameters);

        return $this;
    }

    public function updateSecondaryResources(ActivityParameters $parameters, \stdClass $stepStructure)
    {
        // Store current resources to clean removed
        $existingResources = $parameters->getSecondaryResources();
        $existingResources = $existingResources->toArray();

        // Publish new resources
        $publishedResources = array();
        if (!empty($stepStructure->resources)) {
            $i = 0;
            foreach ($stepStructure->resources as $resource) {
                $resourceNode = $this->om->getRepository('ClarolineCoreBundle:Resource\ResourceNode')->findOneById($resource->resourceId);
                if (!empty($resourceNode)) {
                    $parameters->addSecondaryResource($resourceNode);
                    $publishedResources[] = $resourceNode;
                } else {
                    $warning = $this->translator->trans('warning_compl_resource_deleted', array('resourceId' => $resource->resourceId, 'resourceName' => $resource->name), "innova_tools");
                    $this->session->getFlashBag()->add('warning', $warning);
                    unset($stepStructure->resources[$i]);
                }
                $i++;
            }
        }

        // Clean removed resources
        foreach ($existingResources as $existingResource) {
            if (!in_array($existingResource, $publishedResources)) {
                $parameters->removeSecondaryResource($existingResource);
            }
        }

        return $this;
    }

    public function import(Path $path, array $data, array $createdResources = array (), array $createdSteps = array ())
    {
        $step = new Step();

        $step->setPath($path);
        if (!empty($data['parent'])) {
            $step->setParent($createdSteps[$data['parent']]);
        }

        $step->setLvl($data['lvl']);
        $step->setOrder($data['order']);

        // Link Step to its Activity
        if (!empty($data['activityNodeId']) && !empty($createdResources[$data['activityNodeId']])) {
            // Step has an Activity
            $step->setActivity($createdResources[$data['activityNodeId']]);
        }

        if (!empty($data['inheritedResources'])) {
            foreach($data['inheritedResources'] as $inherited) {
                $inheritedResource = new InheritedResource();
                $inheritedResource->setLvl($inherited['lvl']);
                $inheritedResource->setStep($step);
                $inheritedResource->setResource($createdResources[$inherited['resource']]->getResourceNode());

                $this->om->persist($inheritedResource);
            }
        }

        $createdSteps[$data['uid']] = $step;

        $this->om->persist($step);

        return $createdSteps;
    }

    /**
     * Transform Step data to export it
     * @param  \Innova\PathBundle\Entity\Step $step
     * @return array
     */
    public function export(Step $step, array &$_data, array &$_files)
    {
        $parent = $step->getParent();
        $activity = $step->getActivity();

        $data = array (
            'uid'                => $step->getId(),
            'parent'             => !empty($parent)   ? $parent->getId()                      : null,
            'activityId'         => !empty($activity) ? $activity->getId()                    : null,
            'activityNodeId'     => !empty($activity) ? $activity->getResourceNode()->getId() : null,
            'order'              => $step->getOrder(),
            'lvl'                => $step->getLvl(),
            'inheritedResources' => array (),
        );

        $inheritedResources = $step->getInheritedResources();

        foreach ($inheritedResources as $inherited) {
            $data['inheritedResources'][] = array (
                'resource' => $inherited->getResource()->getId(),
                'lvl'      => $inherited->getLvl(),
            );
        }

        if (!$this->container->get('claroline.importer.rich_text_formatter')->getItemFromUid($step->getId(), $_data)) {
            $this->createActivityFolder($_data);
            $node = $this->resourceManager->getNode($step->getId());

            if ($node && $node->getResourceType() === 'activity') {
                $el = $this->container->get('claroline.importer.rich_text_formatter')
                    ->getImporterByName('resource_manager')->getResourceElement(
                        $node,
                        $node->getWorkspace(),
                        $_files,
                        true
                    );
                $el['item']['parent'] = 'activity_folder';
                $el['item']['roles'] = array(array('role' => array(
                    'name'   => 'ROLE_USER',
                    'rights' => $this->maskManager->decodeMask(7, $this->resourceManager->getResourceTypeByName('activity'))
                )));
                $_data['items'][] = $el;
            }
        }

        return $data;
    }

    private function createActivityFolder(array &$_data)
    {
        if ($this->activityFolderExists($_data)) return null;

        $roles = array();
        $roles[] = array('role' =>array(
            'name'   => 'ROLE_USER',
            'rights' => $this->maskManager->decodeMask(7, $this->resourceManager->getResourceTypeByName('directory'))
        ));

        $parentId = $_data['root']['uid'];

        $_data['directories'][] = array('directory' => array(
            'name'      => 'activity_folder',
            'creator'   => null,
            'parent'    => $parentId,
            'published' => true,
            'uid'       => 'activity_folder',
            'roles'     => $roles,
            'index'     => null
        ));
    }

    private function activityFolderExists(array &$_data)
    {
        if (!isset($data['directories'])) return false;
        foreach ($data['directories'] as $directory) {
            if ($directory['directory']['uid'] === 'activity_folder') return true;
        }

        return false;
    }
}
